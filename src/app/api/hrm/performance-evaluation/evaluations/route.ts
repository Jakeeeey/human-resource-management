import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  EVALUATION_ERROR_CODES,
  evaluationError,
  mapWriteFailure,
  ok,
  readSession,
  serverError,
  unauthorized,
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
  EvaluationTrackingSchema,
} from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation.schema";
import { CreateEvaluationSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation-api.schema";
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

export async function POST(req: NextRequest) {
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

    const body: unknown = await req.json().catch(() => null);
    const validation = CreateEvaluationSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const input = validation.data;

    const employeeDepartmentId = await resolveEmployeeDepartmentId(
      input.user_id
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

    const duplicateBody = (await dFetch(
      `/items/employee_evaluation?filter[user_id][_eq]=${input.user_id}&filter[eval_type][_eq]=${input.eval_type}&filter[voided_at][_null]=true&fields=id&limit=1`
    )) as { data?: unknown; errors?: unknown };
    if (duplicateBody?.errors) {
      console.error(
        "[performance-evaluation] evaluation duplicate check failed:",
        JSON.stringify(duplicateBody.errors)
      );
      return serverError();
    }
    if (Array.isArray(duplicateBody?.data) && duplicateBody.data.length > 0) {
      return evaluationError(
        409,
        EVALUATION_ERROR_CODES.rowExists,
        `A non-voided ${input.eval_type} evaluation already exists for user ${input.user_id}`
      );
    }

    const scoreInputs = criteria.map((criterion) => ({
      rating: input.ratings.find((entry) => entry.criterion_id === criterion.id)?.rating ?? 0,
      weight_percentage_snapshot: criterion.weight_percentage,
    }));
    const totalScore = computeTotalScore(scoreInputs);
    const band = ratingBand(totalScore);

    const now = nowPH();
    const created = (await dFetch("/items/employee_evaluation", {
      method: "POST",
      body: JSON.stringify(
        stampCreate(
          {
            user_id: input.user_id,
            eval_type: input.eval_type,
            evaluation_date: input.evaluation_date,
            total_score: totalScore,
            rating_band: band,
            result: input.result,
            evaluator_comments: input.evaluator_comments ?? null,
            created_at: now,
            updated_at: now,
          },
          actorId
        )
      ),
    })) as { data?: unknown; errors?: unknown };
    if (created?.errors || !created?.data) {
      console.error(
        "[performance-evaluation] evaluation create failed:",
        JSON.stringify(created)
      );
      return mapWriteFailure(created);
    }
    const evaluationParsed = EmployeeEvaluationSchema.safeParse(created.data);
    if (!evaluationParsed.success) {
      console.error(
        "[performance-evaluation] evaluation row contract mismatch:",
        JSON.stringify(evaluationParsed.error.flatten())
      );
      return serverError();
    }
    const evaluation = evaluationParsed.data;

    const ratingByCriterionId = new Map(
      input.ratings.map((entry) => [entry.criterion_id, entry.rating] as const)
    );
    const itemRows = criteria.map((criterion) =>
      stampCreate(
        {
          evaluation_id: evaluation.id,
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
        "[performance-evaluation] evaluation items create failed:",
        JSON.stringify(itemsCreated)
      );
      return mapWriteFailure(itemsCreated);
    }
    const itemsBody = (await dFetch(
      `/items/employee_evaluation_item?filter[evaluation_id][_eq]=${evaluation.id}&limit=-1`
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

    const trackingBody = (await dFetch(
      `/items/employee_evaluation_tracking?filter[user_id][_eq]=${input.user_id}&limit=1`
    )) as { data?: unknown; errors?: unknown };
    if (trackingBody?.errors) {
      console.error(
        "[performance-evaluation] evaluation tracking lookup failed:",
        JSON.stringify(trackingBody.errors)
      );
      return serverError();
    }
    const trackingRow = Array.isArray(trackingBody?.data) ? trackingBody.data[0] : undefined;
    if (trackingRow === undefined) {
      const userBody = (await dFetch(
        `/items/user?filter[user_id][_eq]=${input.user_id}&fields=user_dateOfHire&limit=1`
      )) as { data?: Array<{ user_dateOfHire?: unknown }>; errors?: unknown };
      if (userBody?.errors) {
        console.error(
          "[performance-evaluation] evaluation hire-date lookup failed:",
          JSON.stringify(userBody.errors)
        );
        return serverError();
      }
      const hiredRaw = Array.isArray(userBody?.data) ? userBody.data[0]?.user_dateOfHire : null;
      const trackingCreated = (await dFetch("/items/employee_evaluation_tracking", {
        method: "POST",
        body: JSON.stringify(
          stampCreate(
            {
              user_id: input.user_id,
              date_hired_snapshot: typeof hiredRaw === "string" ? hiredRaw : null,
              created_at: now,
              updated_at: now,
            },
            actorId
          )
        ),
      })) as { data?: unknown; errors?: unknown };
      if (trackingCreated?.errors || !trackingCreated?.data) {
        console.error(
          "[performance-evaluation] evaluation tracking create failed:",
          JSON.stringify(trackingCreated)
        );
        return mapWriteFailure(trackingCreated);
      }
      if (!EvaluationTrackingSchema.safeParse(trackingCreated.data).success) {
        console.error("[performance-evaluation] evaluation tracking row contract mismatch");
        return serverError();
      }
    } else {
      const trackingParsed = EvaluationTrackingSchema.safeParse(trackingRow);
      if (!trackingParsed.success) {
        console.error(
          "[performance-evaluation] evaluation tracking row contract mismatch:",
          JSON.stringify(trackingParsed.error.flatten())
        );
        return serverError();
      }
      const touched = (await dFetch(
        `/items/employee_evaluation_tracking/${trackingParsed.data.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(stampUpdate({ updated_at: nowPH() }, actorId)),
        }
      )) as { data?: unknown; errors?: unknown };
      if (touched?.errors || !touched?.data) {
        console.error(
          "[performance-evaluation] evaluation tracking touch failed:",
          JSON.stringify(touched)
        );
        return mapWriteFailure(touched);
      }
      if (!EvaluationTrackingSchema.safeParse(touched.data).success) {
        console.error("[performance-evaluation] evaluation tracking row contract mismatch");
        return serverError();
      }
    }

    return ok({ evaluation, items }, 201);
  } catch (error) {
    console.error("[performance-evaluation] evaluation create error:", error);
    return serverError();
  }
}
