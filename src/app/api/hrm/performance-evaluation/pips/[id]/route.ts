import { NextResponse, type NextRequest } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  actorIdFromJwt,
  nowPH,
  stampCreate,
  stampUpdate,
} from "@/modules/human-resource-management/performance-evaluation/utils/audit";
import {
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
  EmployeePipActionPlanSchema,
  EmployeePipAreaSchema,
  EmployeePipSchema,
  EvaluationTrackingSchema,
} from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation.schema";
import { UpdatePipSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function deleteChildRows(collection: string, pipId: number) {
  const existing: unknown = await dFetch(
    `/items/${collection}?filter[pip_id][_eq]=${pipId}&fields=id&limit=-1`
  );
  const rows = unwrapData<unknown[]>(existing);
  const ids: number[] = [];
  for (const row of rows) {
    const id = (row as { id?: unknown }).id;
    if (typeof id === "number" && Number.isInteger(id)) ids.push(id);
  }
  if (ids.length > 0) {
    await dFetch(`/items/${collection}`, {
      method: "DELETE",
      body: JSON.stringify(ids),
    });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const pipId = Number(id);
    if (!Number.isInteger(pipId) || pipId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid PIP id" },
        { status: 400 }
      );
    }

    const body: unknown = await req.json().catch(() => null);
    const validation = UpdatePipSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const input = validation.data;

    const pipResult = (await dFetch(`/items/employee_pip/${pipId}`)) as {
      data?: unknown;
      errors?: unknown;
    };
    if (pipResult?.errors || !pipResult?.data) {
      if (isAbsentItemError(pipResult)) {
        return notFound("PIP not found");
      }
      console.error(
        "[performance-evaluation-pips] pip fetch failed:",
        JSON.stringify(pipResult)
      );
      return serverError();
    }
    const pipParsed = EmployeePipSchema.safeParse(pipResult.data);
    if (!pipParsed.success) {
      console.error(
        "[performance-evaluation-pips] pip row contract mismatch:",
        JSON.stringify(pipParsed.error.flatten())
      );
      return serverError();
    }
    const current = pipParsed.data;
    if (current.status === "failed") {
      return NextResponse.json(
        {
          success: false,
          message: "A failed PIP is final and cannot be edited",
        },
        { status: 409 }
      );
    }

    const now = nowPH();
    const headerPatch: Record<string, unknown> = {};
    if (input.user_id !== undefined) headerPatch.user_id = input.user_id;
    if (input.evaluation_id !== undefined) {
      headerPatch.evaluation_id = input.evaluation_id;
    }
    if (input.pip_start_date !== undefined) {
      headerPatch.pip_start_date = input.pip_start_date;
    }
    if (input.pip_end_date !== undefined) {
      headerPatch.pip_end_date = input.pip_end_date;
    }
    if (input.immediate_superior_id !== undefined) {
      headerPatch.immediate_superior_id = input.immediate_superior_id;
    }
    if (input.detailed_concerns !== undefined) {
      headerPatch.detailed_concerns = input.detailed_concerns;
    }
    if (input.status !== undefined) {
      headerPatch.status = input.status;
      if (input.status === "passed" || input.status === "failed") {
        headerPatch.closed_at = now;
        headerPatch.closed_by = actorId;
      }
    }

    if (Object.keys(headerPatch).length > 0) {
      const patched = (await dFetch(`/items/employee_pip/${pipId}`, {
        method: "PATCH",
        body: JSON.stringify(
          stampUpdate({ ...headerPatch, updated_at: now }, actorId)
        ),
      })) as { data?: unknown; errors?: unknown };
      if (patched?.errors) {
        console.error(
          "[performance-evaluation-pips] pip update failed:",
          JSON.stringify(patched)
        );
        return mapWriteFailure(patched);
      }
    }

    if (input.areas !== undefined) {
      await deleteChildRows("employee_pip_area", pipId);
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
          "[performance-evaluation-pips] pip area replacement failed:",
          JSON.stringify(areasInserted)
        );
        return mapWriteFailure(areasInserted);
      }
    }

    if (input.action_plan !== undefined) {
      await deleteChildRows("employee_pip_action_plan", pipId);
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
        const plansInserted = (await dFetch(
          "/items/employee_pip_action_plan",
          {
            method: "POST",
            body: JSON.stringify(planPayload),
          }
        )) as { data?: unknown; errors?: unknown };
        if (plansInserted?.errors) {
          console.error(
            "[performance-evaluation-pips] pip action plan replacement failed:",
            JSON.stringify(plansInserted)
          );
          return mapWriteFailure(plansInserted);
        }
      }
    }

    if (input.status === "failed") {
      const trackingBody: unknown = await dFetch(
        `/items/employee_evaluation_tracking?filter[user_id][_eq]=${current.user_id}&limit=1`
      );
      const trackingRows = unwrapData<unknown[]>(trackingBody);
      const firstRow = Array.isArray(trackingRows) ? trackingRows[0] : undefined;
      const trackingParsed =
        firstRow === undefined
          ? null
          : EvaluationTrackingSchema.safeParse(firstRow);
      if (trackingParsed && !trackingParsed.success) {
        console.error(
          "[performance-evaluation-pips] tracking row contract mismatch:",
          JSON.stringify(trackingParsed.error.flatten())
        );
        return serverError();
      }
      if (trackingParsed) {
        const stamped = (await dFetch(
          `/items/employee_evaluation_tracking/${trackingParsed.data.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(
              stampUpdate(
                {
                  terminated_at: now,
                  terminated_by: actorId,
                  separation_type: "failed_probation",
                  updated_at: now,
                },
                actorId
              )
            ),
          }
        )) as { data?: unknown; errors?: unknown };
        if (stamped?.errors) {
          console.error(
            "[performance-evaluation-pips] tracking termination stamp failed:",
            JSON.stringify(stamped)
          );
          return mapWriteFailure(stamped);
        }
      } else {
        const createdTracking = (await dFetch(
          "/items/employee_evaluation_tracking",
          {
            method: "POST",
            body: JSON.stringify(
              stampCreate(
                {
                  user_id: current.user_id,
                  terminated_at: now,
                  terminated_by: actorId,
                  separation_type: "failed_probation",
                  created_at: now,
                  updated_at: now,
                },
                actorId
              )
            ),
          }
        )) as { data?: unknown; errors?: unknown };
        if (createdTracking?.errors || !createdTracking?.data) {
          console.error(
            "[performance-evaluation-pips] tracking create failed:",
            JSON.stringify(createdTracking)
          );
          return mapWriteFailure(createdTracking);
        }
      }
    }

    const reread = (await dFetch(`/items/employee_pip/${pipId}`)) as {
      data?: unknown;
      errors?: unknown;
    };
    if (reread?.errors || !reread?.data) {
      console.error(
        "[performance-evaluation-pips] pip re-read failed:",
        JSON.stringify(reread)
      );
      return serverError();
    }
    const rereadParsed = EmployeePipSchema.safeParse(reread.data);
    if (!rereadParsed.success) {
      console.error(
        "[performance-evaluation-pips] pip re-read contract mismatch:",
        JSON.stringify(rereadParsed.error.flatten())
      );
      return serverError();
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

    return ok({
      pip: rereadParsed.data,
      areas: parsedAreas,
      actionPlans: parsedPlans,
    });
  } catch (error) {
    console.error("[performance-evaluation-pips] update error:", error);
    return serverError();
  }
}
