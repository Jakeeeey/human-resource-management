import { NextResponse, type NextRequest } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  actorIdFromJwt,
  nowPH,
  stampCreate,
} from "@/modules/human-resource-management/performance-evaluation/utils/audit";
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
  EmployeeEvaluationSchema,
  EmployeePipActionPlanSchema,
  EmployeePipAreaSchema,
  EmployeePipSchema,
} from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation.schema";
import { CreatePipSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation-api.schema";

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
        { success: false, message: "Forbidden: missing capability 'canEvaluate'" },
        { status: 403 }
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const validation = CreatePipSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const input = validation.data;

    const evaluationResult = (await dFetch(
      `/items/employee_evaluation/${input.evaluation_id}`
    )) as { data?: unknown; errors?: unknown };
    if (evaluationResult?.errors || !evaluationResult?.data) {
      if (isAbsentItemError(evaluationResult)) {
        return notFound("Evaluation not found");
      }
      console.error(
        "[performance-evaluation-pips] evaluation fetch failed:",
        JSON.stringify(evaluationResult)
      );
      return serverError();
    }
    const evaluationParsed = EmployeeEvaluationSchema.safeParse(
      evaluationResult.data
    );
    if (!evaluationParsed.success) {
      console.error(
        "[performance-evaluation-pips] evaluation row contract mismatch:",
        JSON.stringify(evaluationParsed.error.flatten())
      );
      return serverError();
    }
    const evaluation = evaluationParsed.data;
    if (evaluation.user_id !== input.user_id) {
      return evaluationError(
        400,
        EVALUATION_ERROR_CODES.readFailed,
        "The evaluation does not belong to this employee"
      );
    }
    if (evaluation.result !== "failed") {
      return evaluationError(
        400,
        EVALUATION_ERROR_CODES.readFailed,
        "A PIP follows a failed evaluation"
      );
    }
    if (evaluation.voided_at !== null) {
      return evaluationError(
        400,
        EVALUATION_ERROR_CODES.readFailed,
        "A PIP cannot be created from a voided evaluation"
      );
    }

    const existingBody: unknown = await dFetch(
      `/items/employee_pip?filter[evaluation_id][_eq]=${input.evaluation_id}&fields=id&limit=1`
    );
    let existingRows: unknown[];
    try {
      existingRows = unwrapData<unknown>(existingBody) as unknown[];
    } catch (error) {
      console.error(
        "[performance-evaluation-pips] duplicate check failed:",
        error
      );
      return serverError();
    }
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "A PIP already exists for this evaluation",
        },
        { status: 409 }
      );
    }

    const now = nowPH();
    const created = (await dFetch("/items/employee_pip", {
      method: "POST",
      body: JSON.stringify(
        stampCreate(
          {
            user_id: input.user_id,
            evaluation_id: input.evaluation_id,
            pip_start_date: input.pip_start_date ?? null,
            pip_end_date: input.pip_end_date ?? null,
            immediate_superior_id: input.immediate_superior_id ?? null,
            detailed_concerns: input.detailed_concerns ?? null,
            status: "open",
            created_at: now,
            updated_at: now,
          },
          actorId
        )
      ),
    })) as { data?: unknown; errors?: unknown };
    if (created?.errors || !created?.data) {
      console.error(
        "[performance-evaluation-pips] pip create failed:",
        JSON.stringify(created)
      );
      return mapWriteFailure(created);
    }
    const pipParsed = EmployeePipSchema.safeParse(created.data);
    if (!pipParsed.success) {
      console.error(
        "[performance-evaluation-pips] pip row contract mismatch:",
        JSON.stringify(pipParsed.error.flatten())
      );
      return serverError();
    }
    const pipId = pipParsed.data.id;

    const areaPayload = input.areas.map((area, index) =>
      stampCreate(
        {
          pip_id: pipId,
          pip_criteria_id: null,
          area_name_snapshot: area,
          selected: true,
          sort_order: index,
          created_at: now,
          updated_at: now,
        },
        actorId
      )
    );
    const areasInserted = (await dFetch("/items/employee_pip_area", {
      method: "POST",
      body: JSON.stringify(areaPayload),
    })) as { data?: unknown; errors?: unknown };
    if (areasInserted?.errors) {
      console.error(
        "[performance-evaluation-pips] pip area snapshot failed:",
        JSON.stringify(areasInserted)
      );
      return mapWriteFailure(areasInserted);
    }

    if (input.action_plan.length > 0) {
      const planPayload = input.action_plan.map((item, index) =>
        stampCreate(
          {
            pip_id: pipId,
            pip_area_id: item.pip_area_id ?? null,
            area_for_improvement: item.area_for_improvement,
            action_plan: item.action_plan ?? null,
            review_date: item.review_date ?? null,
            result: item.result ?? null,
            sort_order: index,
            created_at: now,
            updated_at: now,
          },
          actorId
        )
      );
      const plansInserted = (await dFetch("/items/employee_pip_action_plan", {
        method: "POST",
        body: JSON.stringify(planPayload),
      })) as { data?: unknown; errors?: unknown };
      if (plansInserted?.errors) {
        console.error(
          "[performance-evaluation-pips] pip action plan insert failed:",
          JSON.stringify(plansInserted)
        );
        return mapWriteFailure(plansInserted);
      }
    }

    const areasBody: unknown = await dFetch(
      `/items/employee_pip_area?filter[pip_id][_eq]=${pipId}&limit=-1&sort=sort_order,id`
    );
    const plansBody: unknown = await dFetch(
      `/items/employee_pip_action_plan?filter[pip_id][_eq]=${pipId}&limit=-1&sort=sort_order,id`
    );
    const areaRows = unwrapData<unknown[]>(areasBody);
    const planRows = unwrapData<unknown[]>(plansBody);
    const parsedAreas = [];
    for (const row of areaRows) {
      const parsed = EmployeePipAreaSchema.safeParse(row);
      if (!parsed.success) {
        console.error(
          "[performance-evaluation-pips] pip area row contract mismatch:",
          JSON.stringify(parsed.error.flatten())
        );
        return serverError();
      }
      parsedAreas.push(parsed.data);
    }
    const parsedPlans = [];
    for (const row of planRows) {
      const parsed = EmployeePipActionPlanSchema.safeParse(row);
      if (!parsed.success) {
        console.error(
          "[performance-evaluation-pips] pip action plan row contract mismatch:",
          JSON.stringify(parsed.error.flatten())
        );
        return serverError();
      }
      parsedPlans.push(parsed.data);
    }

    return ok(
      { pip: pipParsed.data, areas: parsedAreas, actionPlans: parsedPlans },
      201
    );
  } catch (error) {
    console.error("[performance-evaluation-pips] create error:", error);
    return serverError();
  }
}
