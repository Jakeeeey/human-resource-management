import { NextRequest, NextResponse } from "next/server";

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
import {
  listKpiCriteria,
  resolveEmployeeDepartmentId,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluation-service";
import {
  EmployeeEvaluationItemSchema,
  EmployeeEvaluationSchema,
} from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation.schema";
import { UpdateEvaluationSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation-api.schema";
import {
  computeTotalScore,
  isWeightSetValid,
  ratingBand,
  sumWeights,
} from "@/modules/human-resource-management/performance-evaluation/utils/kpiScore";
import {
  actorIdFromJwt,
  nowPH,
  stampCreate,
  stampUpdate,
} from "@/modules/human-resource-management/performance-evaluation/utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    const validation = UpdateEvaluationSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const input = validation.data;

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
    const existing = existingParsed.data;
    if (existing.voided_at !== null) {
      return evaluationError(
        409,
        EVALUATION_ERROR_CODES.writeFailed,
        "A voided evaluation is immutable"
      );
    }

    const effectiveUserId = input.user_id ?? existing.user_id;
    const effectiveEvalType = input.eval_type ?? existing.eval_type;
    if (effectiveUserId !== existing.user_id || effectiveEvalType !== existing.eval_type) {
      const clashBody = (await dFetch(
        `/items/employee_evaluation?filter[user_id][_eq]=${effectiveUserId}&filter[eval_type][_eq]=${effectiveEvalType}&filter[voided_at][_null]=true&filter[id][_neq]=${evaluationId}&fields=id&limit=1`
      )) as { data?: unknown; errors?: unknown };
      if (clashBody?.errors) {
        console.error(
          "[performance-evaluation] evaluation duplicate check failed:",
          JSON.stringify(clashBody.errors)
        );
        return serverError();
      }
      if (Array.isArray(clashBody?.data) && clashBody.data.length > 0) {
        return evaluationError(
          409,
          EVALUATION_ERROR_CODES.rowExists,
          `A non-voided ${effectiveEvalType} evaluation already exists for user ${effectiveUserId}`
        );
      }
    }

    const employeeDepartmentId = await resolveEmployeeDepartmentId(
      effectiveUserId
    );
    if (
      employeeDepartmentId === null ||
      (!capability.isAdmin &&
        !capability.headScopeDepartmentIds.includes(employeeDepartmentId))
    ) {
      return NextResponse.json(
        { success: false, message: "Forbidden: evaluation requires head, HR, or admin access" },
        { status: 403 }
      );
    }

    const criteria = await listKpiCriteria(employeeDepartmentId, false);
    if (criteria.length === 0) {
      return evaluationError(
        400,
        EVALUATION_ERROR_CODES.criteriaNotConfigured,
        "No active KPI criteria configured for this department"
      );
    }
    const libraryWeights = criteria.map((criterion) => ({
      weight_percentage_snapshot: criterion.weight_percentage,
    }));
    if (!isWeightSetValid(libraryWeights)) {
      return evaluationError(
        400,
        EVALUATION_ERROR_CODES.criteriaWeightInvalid,
        `Active KPI criterion weights must sum to 100 (actual: ${sumWeights(libraryWeights)})`
      );
    }

    const weightByCriterionId = new Map(
      criteria.map((criterion) => [criterion.id, criterion.weight_percentage] as const)
    );
    const seenCriterionIds = new Set<number>();
    for (const entry of input.ratings) {
      if (!weightByCriterionId.has(entry.criterion_id)) {
        return evaluationError(
          400,
          EVALUATION_ERROR_CODES.writeFailed,
          `Unknown criterion id ${entry.criterion_id}`
        );
      }
      if (seenCriterionIds.has(entry.criterion_id)) {
        return evaluationError(
          400,
          EVALUATION_ERROR_CODES.writeFailed,
          `Duplicate rating for criterion id ${entry.criterion_id}`
        );
      }
      seenCriterionIds.add(entry.criterion_id);
    }
    const missingIds = criteria
      .filter((criterion) => !seenCriterionIds.has(criterion.id))
      .map((criterion) => criterion.id);
    if (missingIds.length > 0) {
      return evaluationError(
        400,
        EVALUATION_ERROR_CODES.writeFailed,
        `Missing ratings for criterion ids: ${missingIds.join(", ")}`
      );
    }

    const ratingByCriterionId = new Map(
      input.ratings.map((entry) => [entry.criterion_id, entry.rating] as const)
    );
    const scoreInputs = criteria.map((criterion) => ({
      rating: ratingByCriterionId.get(criterion.id) ?? 0,
      weight_percentage_snapshot: criterion.weight_percentage,
    }));
    const totalScore = computeTotalScore(scoreInputs);
    const band = ratingBand(totalScore);

    const now = nowPH();
    const currentItemsBody = (await dFetch(
      `/items/employee_evaluation_item?filter[evaluation_id][_eq]=${evaluationId}&fields=id&limit=-1`
    )) as { data?: unknown; errors?: unknown };
    if (currentItemsBody?.errors) {
      console.error(
        "[performance-evaluation] evaluation items lookup failed:",
        JSON.stringify(currentItemsBody.errors)
      );
      return serverError();
    }
    const currentIds = (Array.isArray(currentItemsBody?.data) ? currentItemsBody.data : [])
      .map((row) => (row as { id?: unknown }).id)
      .filter((id): id is number => typeof id === "number");
    if (currentIds.length > 0) {
      const deleted = (await dFetch("/items/employee_evaluation_item", {
        method: "DELETE",
        body: JSON.stringify(currentIds),
      })) as { errors?: unknown } | null;
      if (deleted !== null && typeof deleted === "object" && "errors" in deleted) {
        console.error(
          "[performance-evaluation] evaluation items delete failed:",
          JSON.stringify(deleted)
        );
        return serverError();
      }
    }
    const itemRows = criteria.map((criterion) =>
      stampCreate(
        {
          evaluation_id: evaluationId,
          criterion_id: criterion.id,
          kpi_category_snapshot: criterion.kpi_category,
          kpi_description_snapshot: criterion.kpi_description,
          target_snapshot: criterion.target,
          measurement_method_snapshot: criterion.measurement_method,
          weight_percentage_snapshot: criterion.weight_percentage,
          rating: ratingByCriterionId.get(criterion.id) ?? 0,
          sort_order: criterion.sort_order,
          created_at: now,
          updated_at: now,
        },
        actorId
      )
    );
    const itemsCreated = (await dFetch("/items/employee_evaluation_item", {
      method: "POST",
      body: JSON.stringify(itemRows),
    })) as { data?: unknown; errors?: unknown };
    if (itemsCreated?.errors || !itemsCreated?.data) {
      console.error(
        "[performance-evaluation] evaluation items replace failed:",
        JSON.stringify(itemsCreated)
      );
      return mapWriteFailure(itemsCreated);
    }
    const itemsBody = (await dFetch(
      `/items/employee_evaluation_item?filter[evaluation_id][_eq]=${evaluationId}&limit=-1`
    )) as { data?: unknown; errors?: unknown };
    if (itemsBody?.errors || !Array.isArray(itemsBody?.data)) {
      console.error(
        "[performance-evaluation] evaluation items read-back failed:",
        JSON.stringify(itemsBody)
      );
      return serverError();
    }
    const items = [];
    for (const row of itemsBody.data) {
      const itemParsed = EmployeeEvaluationItemSchema.safeParse(row);
      if (!itemParsed.success) {
        console.error(
          "[performance-evaluation] evaluation item row contract mismatch:",
          JSON.stringify(itemParsed.error.flatten())
        );
        return serverError();
      }
      items.push(itemParsed.data);
    }

    const patchPayload: Record<string, unknown> = {
      total_score: totalScore,
      rating_band: band,
      updated_at: nowPH(),
    };
    if (input.user_id !== undefined) patchPayload.user_id = input.user_id;
    if (input.eval_type !== undefined) patchPayload.eval_type = input.eval_type;
    if (input.evaluation_date !== undefined) patchPayload.evaluation_date = input.evaluation_date;
    if (input.result !== undefined) patchPayload.result = input.result;
    if (input.evaluator_comments !== undefined) {
      patchPayload.evaluator_comments = input.evaluator_comments;
    }
    const patched = (await dFetch(`/items/employee_evaluation/${evaluationId}`, {
      method: "PATCH",
      body: JSON.stringify(stampUpdate(patchPayload, actorId)),
    })) as { data?: unknown; errors?: unknown };
    if (patched?.errors || !patched?.data) {
      console.error(
        "[performance-evaluation] evaluation update failed:",
        JSON.stringify(patched)
      );
      return mapWriteFailure(patched);
    }
    const evaluationParsed = EmployeeEvaluationSchema.safeParse(patched.data);
    if (!evaluationParsed.success) {
      console.error(
        "[performance-evaluation] evaluation row contract mismatch:",
        JSON.stringify(evaluationParsed.error.flatten())
      );
      return serverError();
    }

    return ok({ evaluation: evaluationParsed.data, items });
  } catch (error) {
    console.error("[performance-evaluation] evaluation update error:", error);
    return serverError();
  }
}
