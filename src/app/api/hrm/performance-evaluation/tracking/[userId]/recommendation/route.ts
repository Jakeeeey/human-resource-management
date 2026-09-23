import { NextResponse, type NextRequest } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  mapRouteError,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluation-route-guards";
import {
  mapWriteFailure,
  ok,
  readSession,
  serverError,
  unauthorized,
  unwrapData,
  validationFailed,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluationApiServer";
import {
  assertCapability,
  resolveEvaluationCapability,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluationCapability";
import { getEvaluationWorkspace } from "@/modules/human-resource-management/performance-evaluation/server/evaluation-service";
import { EvaluationTrackingSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation.schema";
import {
  actorIdFromJwt,
  nowPH,
  stampCreate,
  stampUpdate,
} from "@/modules/human-resource-management/performance-evaluation/utils/audit";
import {
  deriveNextAction,
  deriveStage,
  type WorkflowFacts,
} from "@/modules/human-resource-management/performance-evaluation/utils/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = readSession(req);
    if (!session) return unauthorized();
    const actorId = actorIdFromJwt(session);
    if (actorId === null) return unauthorized();
    const cap = await resolveEvaluationCapability(actorId);
    assertCapability(cap, "canFinalize");

    const { userId: userIdParam } = await params;
    const userId = Number(userIdParam);
    if (!Number.isInteger(userId) || userId <= 0) {
      return validationFailed({ user_id: ["Must be a positive integer"] });
    }

    const workspace = await getEvaluationWorkspace(userId);
    const evalTypeById = new Map<number, "first" | "second">();
    for (const evaluation of workspace.evaluations) {
      evalTypeById.set(evaluation.id, evaluation.eval_type);
    }
    const facts: WorkflowFacts = {
      dateHired: workspace.tracking?.date_hired_snapshot ?? null,
      regularizedAt: workspace.tracking?.regularized_at ?? null,
      terminatedAt: workspace.tracking?.terminated_at ?? null,
      recommendationIssuedAt:
        workspace.tracking?.recommendation_issued_at ?? null,
      evaluations: workspace.evaluations.map((evaluation) => ({
        evalType: evaluation.eval_type,
        result: evaluation.result,
        voidedAt: evaluation.voided_at,
      })),
      pips: workspace.pips.map((pip) => ({
        evaluationId: pip.evaluation_id,
        evalType: evalTypeById.get(pip.evaluation_id) ?? "first",
        status: pip.status,
      })),
    };
    if (deriveNextAction(facts)?.key !== "recommendation") {
      const stage = deriveStage(facts);
      return NextResponse.json(
        {
          success: false,
          message: `The recommendation letter cannot be issued while the employee is at stage '${stage}'.`,
        },
        { status: 400 }
      );
    }

    const now = nowPH();
    if (workspace.tracking) {
      const patched = (await dFetch(
        `/items/employee_evaluation_tracking/${workspace.tracking.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(
            stampUpdate(
              {
                recommendation_issued_at: now,
                recommendation_issued_by: actorId,
                updated_at: now,
              },
              actorId
            )
          ),
        }
      )) as { data?: unknown; errors?: unknown };
      if (patched?.errors || !patched?.data) return mapWriteFailure(patched);
    } else {
      const created = (await dFetch("/items/employee_evaluation_tracking", {
        method: "POST",
        body: JSON.stringify(
          stampCreate(
            {
              user_id: userId,
              recommendation_issued_at: now,
              recommendation_issued_by: actorId,
              updated_at: now,
            },
            actorId
          )
        ),
      })) as { data?: unknown; errors?: unknown };
      if (created?.errors || !created?.data) return mapWriteFailure(created);
    }

    const readBack: unknown = await dFetch(
      `/items/employee_evaluation_tracking?filter[user_id][_eq]=${userId}&limit=1`
    );
    const rows = unwrapData<unknown>(readBack);
    const parsed = EvaluationTrackingSchema.safeParse(
      Array.isArray(rows) ? rows[0] : undefined
    );
    if (!parsed.success) return serverError();
    return ok(parsed.data);
  } catch (error) {
    return mapRouteError(error);
  }
}
