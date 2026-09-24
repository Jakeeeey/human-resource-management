import { NextResponse, type NextRequest } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  actorIdFromJwt,
  nowPH,
  stampCreate,
} from "@/modules/human-resource-management/performance-evaluation/utils/audit";
import {
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
  EmployeePipActionPlanSchema,
  EmployeePipAreaSchema,
  EmployeePipSchema,
} from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation.schema";
import { CreatePipSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation-api.schema";
import {
  assertEmployeeOpen,
  assertNoExistingPip,
  assertPipDatesCoherent,
  distinctPipAreas,
  fetchLiveFailedEvaluation,
  fetchTrackingByUserId,
  PIP_ERROR_CODES,
  PipGateError,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pipError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ success: false, code, message }, { status });
}

function rawString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

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
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return validationFailed({ body: ["Must be an object"] });
    }
    const raw = body as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(raw, "status")) {
      return pipError(
        422,
        PIP_ERROR_CODES.statusPremature,
        "Status is set by the head during evaluation, not at creation"
      );
    }
    if (Array.isArray(raw.action_plan)) {
      for (const item of raw.action_plan) {
        if (typeof item === "object" && item !== null) {
          const record = item as Record<string, unknown>;
          if (
            Object.prototype.hasOwnProperty.call(record, "review_date") ||
            Object.prototype.hasOwnProperty.call(record, "result")
          ) {
            return pipError(
              422,
              PIP_ERROR_CODES.resultPremature,
              "Review dates and results can only be recorded after employee acknowledgement"
            );
          }
        }
      }
      if (raw.action_plan.length < 1) {
        return pipError(
          422,
          PIP_ERROR_CODES.planIncomplete,
          "The PIP needs at least one action-plan row"
        );
      }
    }
    try {
      assertPipDatesCoherent(
        rawString(raw.pip_start_date),
        rawString(raw.pip_end_date)
      );
    } catch (error) {
      if (error instanceof PipGateError) {
        return pipError(error.status, error.code, error.message);
      }
      throw error;
    }
    const validation = CreatePipSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const input = validation.data;

    let evaluationUserId: number;
    try {
      const evaluation = await fetchLiveFailedEvaluation(input.evaluation_id);
      evaluationUserId = evaluation.user_id;
    } catch (error) {
      if (error instanceof PipGateError) {
        return pipError(error.status, error.code, error.message);
      }
      console.error(
        "[performance-evaluation-pips] evaluation fetch failed:",
        error
      );
      return serverError();
    }

    try {
      await assertNoExistingPip(input.evaluation_id);
      assertEmployeeOpen(await fetchTrackingByUserId(evaluationUserId));
    } catch (error) {
      if (error instanceof PipGateError) {
        return pipError(error.status, error.code, error.message);
      }
      console.error(
        "[performance-evaluation-pips] pre-create guard read failed:",
        error
      );
      return serverError();
    }

    const now = nowPH();
    const created = (await dFetch("/items/employee_pip", {
      method: "POST",
      body: JSON.stringify(
        stampCreate(
          {
            user_id: evaluationUserId,
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

    const areas = distinctPipAreas(input.action_plan);
    if (areas.length < 1) {
      return pipError(
        422,
        PIP_ERROR_CODES.planIncomplete,
        "The PIP needs at least one area"
      );
    }
    const areaPayload = areas.map((area, index) =>
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

    const planPayload = input.action_plan.map((item, index) =>
      stampCreate(
        {
          pip_id: pipId,
          pip_area_id: item.pip_area_id ?? null,
          area_for_improvement: item.area,
          action_plan: item.action,
          review_date: null,
          result: null,
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

    const areasBody: unknown = await dFetch(
      `/items/employee_pip_area?filter[pip_id][_eq]=${pipId}&limit=-1&sort=sort_order,id`
    );
    const plansBody: unknown = await dFetch(
      `/items/employee_pip_action_plan?filter[pip_id][_eq]=${pipId}&limit=-1&sort=sort_order,id`
    );
    let areaRows: unknown[];
    let planRows: unknown[];
    try {
      areaRows = unwrapData<unknown[]>(areasBody);
      planRows = unwrapData<unknown[]>(plansBody);
    } catch (error) {
      console.error(
        "[performance-evaluation-pips] pip re-read failed:",
        error
      );
      return notFound("PIP not found");
    }
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
