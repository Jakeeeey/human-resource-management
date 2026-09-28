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
import { EvaluationTrackingSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation.schema";
import {
  actorIdFromJwt,
  nowPH,
  stampUpdate,
} from "@/modules/human-resource-management/performance-evaluation/utils/audit";

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

    const body: unknown = await dFetch(
      `/items/employee_evaluation_tracking?filter[user_id][_eq]=${userId}&limit=1`
    );
    const rows = unwrapData<unknown>(body);
    const tracked = EvaluationTrackingSchema.safeParse(
      Array.isArray(rows) ? rows[0] : undefined
    );
    if (!tracked.success || tracked.data.recommendation_issued_at === null) {
      return NextResponse.json(
        {
          success: false,
          message: "Issue the recommendation letter first.",
        },
        { status: 400 }
      );
    }
    if (tracked.data.regularized_at !== null) {
      return NextResponse.json(
        { success: false, message: "The employee is already regularized." },
        { status: 409 }
      );
    }

    const now = nowPH();
    const patched = (await dFetch(
      `/items/employee_evaluation_tracking/${tracked.data.id}`,
      {
        method: "PATCH",
        body: JSON.stringify(
          stampUpdate(
            {
              regularized_at: now,
              regularized_by: actorId,
              updated_at: now,
            },
            actorId
          )
        ),
      }
    )) as { data?: unknown; errors?: unknown };
    if (patched?.errors || !patched?.data) return mapWriteFailure(patched);

    const readBack: unknown = await dFetch(
      `/items/employee_evaluation_tracking/${tracked.data.id}`
    );
    const parsed = EvaluationTrackingSchema.safeParse(
      unwrapData<unknown>(readBack)
    );
    if (!parsed.success) return serverError();
    return ok(parsed.data);
  } catch (error) {
    return mapRouteError(error);
  }
}
