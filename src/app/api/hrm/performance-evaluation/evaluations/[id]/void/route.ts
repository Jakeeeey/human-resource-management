import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  EVALUATION_ERROR_CODES,
  evaluationError,
  isAbsentItemError,
  mapWriteFailure,
  notFound,
  ok,
  readSession,
  serverError,
  unauthorized,
  unwrapData,
  validationFailed,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluationApiServer";
import { resolveEvaluationCapability } from "@/modules/human-resource-management/performance-evaluation/server/evaluationCapability";
import { EmployeeEvaluationSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation.schema";
import {
  actorIdFromJwt,
  nowPH,
  stampUpdate,
} from "@/modules/human-resource-management/performance-evaluation/utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VoidEvaluationSchema = z
  .object({
    void_reason: z.string().min(1).max(1000),
  })
  .strict();

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = readSession(req);
    if (!session) return unauthorized();
    const actorId = actorIdFromJwt(session);
    if (actorId === null) return unauthorized();
    const capability = await resolveEvaluationCapability(actorId);
    if (!capability.canEvaluate) {
      return NextResponse.json(
        { success: false, message: "Forbidden: evaluation requires head, HR, or admin access" },
        { status: 403 }
      );
    }

    const { id: rawId } = await context.params;
    const evaluationId = Number(rawId);
    if (!Number.isInteger(evaluationId) || evaluationId <= 0) {
      return validationFailed({ id: ["Evaluation id must be a positive integer"] });
    }

    const body: unknown = await req.json().catch(() => null);
    const validation = VoidEvaluationSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const existingBody = (await dFetch(`/items/employee_evaluation/${evaluationId}`)) as {
      data?: unknown;
      errors?: unknown;
    };
    if (isAbsentItemError(existingBody)) return notFound("Evaluation not found");
    const existingParsed = EmployeeEvaluationSchema.safeParse(unwrapData<unknown>(existingBody));
    if (!existingParsed.success) {
      console.error(
        "[performance-evaluation] evaluation row contract mismatch:",
        JSON.stringify(existingParsed.error.flatten())
      );
      return serverError();
    }
    if (existingParsed.data.voided_at !== null) {
      return evaluationError(
        409,
        EVALUATION_ERROR_CODES.writeFailed,
        "Evaluation is already voided"
      );
    }

    const pipBody = (await dFetch(
      `/items/employee_pip?filter[evaluation_id][_eq]=${evaluationId}&fields=id&limit=1`
    )) as { data?: unknown; errors?: unknown };
    if (pipBody?.errors) {
      console.error(
        "[performance-evaluation] evaluation pip check failed:",
        JSON.stringify(pipBody.errors)
      );
      return serverError();
    }
    if (Array.isArray(pipBody?.data) && pipBody.data.length > 0) {
      return evaluationError(
        409,
        EVALUATION_ERROR_CODES.rowExists,
        "A PIP exists for this evaluation; resolve or remove the PIP before voiding"
      );
    }

    const voided = (await dFetch(`/items/employee_evaluation/${evaluationId}`, {
      method: "PATCH",
      body: JSON.stringify(
        stampUpdate(
          {
            voided_at: nowPH(),
            voided_by: actorId,
            void_reason: validation.data.void_reason,
            updated_at: nowPH(),
          },
          actorId
        )
      ),
    })) as { data?: unknown; errors?: unknown };
    if (voided?.errors || !voided?.data) {
      console.error(
        "[performance-evaluation] evaluation void failed:",
        JSON.stringify(voided)
      );
      return mapWriteFailure(voided);
    }

    const readBack = (await dFetch(`/items/employee_evaluation/${evaluationId}`)) as {
      data?: unknown;
      errors?: unknown;
    };
    if (isAbsentItemError(readBack) || readBack?.errors) {
      console.error(
        "[performance-evaluation] evaluation void read-back failed:",
        JSON.stringify(readBack)
      );
      return serverError();
    }
    const evaluationParsed = EmployeeEvaluationSchema.safeParse(unwrapData<unknown>(readBack));
    if (!evaluationParsed.success) {
      console.error(
        "[performance-evaluation] evaluation row contract mismatch:",
        JSON.stringify(evaluationParsed.error.flatten())
      );
      return serverError();
    }

    return ok(evaluationParsed.data);
  } catch (error) {
    console.error("[performance-evaluation] evaluation void error:", error);
    return serverError();
  }
}
