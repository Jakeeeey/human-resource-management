import { NextResponse, type NextRequest } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  actorIdFromJwt,
  nowPH,
  stampCreate,
  stampUpdate,
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
  EvaluationTrackingSchema,
  type EmployeePip,
  type EmployeePipActionPlan,
} from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation.schema";
import {
  UpdatePipSchema,
  type UpdatePipInput,
} from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation-api.schema";
import {
  assertCanRecordOutcome,
  assertEmployeeOpen,
  assertOutcomeCompleteForFinalize,
  assertPipDatesCoherent,
  assertPlanEditable,
  assertReviewDatesInRange,
  buildOutcomeWrites,
  decidePipPatchIntent,
  distinctPipAreas,
  fetchEvaluationById,
  fetchPipPlans,
  fetchPipRow,
  fetchTrackingByUserId,
  mergedOutcomeRows,
  PIP_ERROR_CODES,
  PipGateError,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pipError(
  status: number,
  code: string,
  message: string,
  indices?: number[]
): NextResponse {
  if (indices !== undefined) {
    return NextResponse.json(
      { success: false, code, message, indices },
      { status }
    );
  }
  return NextResponse.json({ success: false, code, message }, { status });
}

function gateError(error: unknown): NextResponse | null {
  if (error instanceof PipGateError) {
    return pipError(error.status, error.code, error.message, error.indices);
  }
  return null;
}

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

async function stampTrackingTerminated(
  pip: EmployeePip,
  actorId: number,
  now: string
): Promise<NextResponse | null> {
  let trackingBody: unknown;
  try {
    trackingBody = await dFetch(
      `/items/employee_evaluation_tracking?filter[user_id][_eq]=${pip.user_id}&limit=1`
    );
  } catch (error) {
    console.error(
      "[performance-evaluation-pips] tracking read failed:",
      error
    );
    return serverError();
  }
  let trackingRows: unknown[];
  try {
    trackingRows = unwrapData<unknown[]>(trackingBody);
  } catch (error) {
    console.error(
      "[performance-evaluation-pips] tracking read failed:",
      error
    );
    return serverError();
  }
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
              user_id: pip.user_id,
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
  return null;
}

async function readBundle(pipId: number) {
  const reread = await fetchPipRow(pipId);
  if (reread === null) {
    console.error("[performance-evaluation-pips] pip re-read failed");
    return null;
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
      return null;
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
      return null;
    }
    parsedPlans.push(parsed.data);
  }
  return { pip: reread, areas: parsedAreas, actionPlans: parsedPlans };
}

async function handleOutcomePath(
  current: EmployeePip,
  storedPlans: EmployeePipActionPlan[],
  input: UpdatePipInput,
  actorId: number
): Promise<NextResponse> {
  try {
    assertCanRecordOutcome(current);
  } catch (error) {
    const mapped = gateError(error);
    if (mapped) return mapped;
    throw error;
  }

  let parentVoided: boolean;
  try {
    const parent = await fetchEvaluationById(current.evaluation_id);
    if (parent === null) {
      return pipError(
        422,
        PIP_ERROR_CODES.parentInvalid,
        "The parent evaluation no longer exists"
      );
    }
    parentVoided = parent.voided_at !== null;
  } catch (error) {
    console.error(
      "[performance-evaluation-pips] parent evaluation read failed:",
      error
    );
    return serverError();
  }
  if (parentVoided) {
    return pipError(
      409,
      PIP_ERROR_CODES.parentVoided,
      "The parent evaluation was voided"
    );
  }

  try {
    assertEmployeeOpen(await fetchTrackingByUserId(current.user_id));
  } catch (error) {
    const mapped = gateError(error);
    if (mapped) return mapped;
    console.error(
      "[performance-evaluation-pips] tracking guard read failed:",
      error
    );
    return serverError();
  }

  let writes;
  try {
    writes = buildOutcomeWrites(storedPlans, input.action_plan ?? []);
  } catch (error) {
    const mapped = gateError(error);
    if (mapped) return mapped;
    throw error;
  }

  try {
    assertReviewDatesInRange(
      writes,
      current.pip_start_date,
      current.pip_end_date
    );
  } catch (error) {
    const mapped = gateError(error);
    if (mapped) return mapped;
    throw error;
  }

  const terminal =
    input.status === "passed" || input.status === "failed";
  if (terminal) {
    try {
      assertOutcomeCompleteForFinalize(mergedOutcomeRows(storedPlans, writes));
    } catch (error) {
      const mapped = gateError(error);
      if (mapped) return mapped;
      throw error;
    }
  }

  const now = nowPH();
  let fresh: EmployeePip | null;
  try {
    fresh = await fetchPipRow(current.id);
  } catch (error) {
    console.error(
      "[performance-evaluation-pips] pip write-time re-read failed:",
      error
    );
    return serverError();
  }
  if (fresh === null) return notFound("PIP not found");
  try {
    assertCanRecordOutcome(fresh);
  } catch (error) {
    const mapped = gateError(error);
    if (mapped) return mapped;
    throw error;
  }

  for (const write of writes) {
    const patched = (await dFetch(
      `/items/employee_pip_action_plan/${write.id}`,
      {
        method: "PATCH",
        body: JSON.stringify(
          stampUpdate(
            {
              review_date: write.review_date,
              result: write.result,
              updated_at: now,
            },
            actorId
          )
        ),
      }
    )) as { data?: unknown; errors?: unknown };
    if (patched?.errors) {
      console.error(
        "[performance-evaluation-pips] pip outcome write failed:",
        JSON.stringify(patched)
      );
      return mapWriteFailure(patched);
    }
  }

  if (input.status !== undefined) {
    const headerPatch: Record<string, unknown> = { status: input.status };
    if (terminal) {
      headerPatch.closed_at = now;
      headerPatch.closed_by = actorId;
    }
    const patched = (await dFetch(`/items/employee_pip/${current.id}`, {
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

  if (input.status === "failed") {
    const trackingFailure = await stampTrackingTerminated(
      current,
      actorId,
      now
    );
    if (trackingFailure) return trackingFailure;
  }

  const bundle = await readBundle(current.id);
  if (!bundle) return serverError();
  return ok(bundle);
}

async function handlePlanPath(
  current: EmployeePip,
  storedPlans: EmployeePipActionPlan[],
  input: UpdatePipInput,
  actorId: number
): Promise<NextResponse> {
  try {
    assertPlanEditable(current);
  } catch (error) {
    const mapped = gateError(error);
    if (mapped) return mapped;
    throw error;
  }

  const start =
    input.pip_start_date !== undefined
      ? input.pip_start_date
      : current.pip_start_date;
  const end =
    input.pip_end_date !== undefined
      ? input.pip_end_date
      : current.pip_end_date;
  try {
    assertPipDatesCoherent(start ?? null, end ?? null);
  } catch (error) {
    const mapped = gateError(error);
    if (mapped) return mapped;
    throw error;
  }

  const now = nowPH();
  let fresh: EmployeePip | null;
  try {
    fresh = await fetchPipRow(current.id);
  } catch (error) {
    console.error(
      "[performance-evaluation-pips] pip write-time re-read failed:",
      error
    );
    return serverError();
  }
  if (fresh === null) return notFound("PIP not found");
  try {
    assertPlanEditable(fresh);
  } catch (error) {
    const mapped = gateError(error);
    if (mapped) return mapped;
    throw error;
  }

  const headerPatch: Record<string, unknown> = {};
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

  if (Object.keys(headerPatch).length > 0) {
    const patched = (await dFetch(`/items/employee_pip/${current.id}`, {
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

  if (input.action_plan !== undefined) {
    const replacement: {
      area_for_improvement: string;
      action_plan: string | null;
      pip_area_id: number | null;
      review_date: string | null;
      result: string | null;
    }[] = [];
    for (let index = 0; index < input.action_plan.length; index += 1) {
      const item = input.action_plan[index];
      const stored = storedPlans[index];
      const area = (item.area ?? stored?.area_for_improvement ?? "").trim();
      if (area === "") {
        return pipError(
          422,
          PIP_ERROR_CODES.planIncomplete,
          "Every action-plan row needs an area"
        );
      }
      const hasAction = Object.prototype.hasOwnProperty.call(item, "action");
      replacement.push({
        area_for_improvement: area,
        action_plan: hasAction ? (item.action ?? null) : (stored?.action_plan ?? null),
        pip_area_id: item.pip_area_id ?? stored?.pip_area_id ?? null,
        review_date: stored?.review_date ?? null,
        result: stored?.result ?? null,
      });
    }
    if (replacement.length < 1) {
      return pipError(
        422,
        PIP_ERROR_CODES.planIncomplete,
        "The PIP needs at least one action-plan row"
      );
    }
    await deleteChildRows("employee_pip_action_plan", current.id);
    const planPayload = replacement.map((row, index) =>
      stampCreate(
        {
          pip_id: current.id,
          pip_area_id: row.pip_area_id,
          area_for_improvement: row.area_for_improvement,
          action_plan: row.action_plan,
          review_date: row.review_date,
          result: row.result,
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
        "[performance-evaluation-pips] pip action plan replacement failed:",
        JSON.stringify(plansInserted)
      );
      return mapWriteFailure(plansInserted);
    }

    await deleteChildRows("employee_pip_area", current.id);
    const areaPayload = distinctPipAreas(
      replacement.map((row) => ({ area: row.area_for_improvement }))
    ).map((area, index) =>
      stampCreate(
        {
          pip_id: current.id,
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

  const bundle = await readBundle(current.id);
  if (!bundle) return serverError();
  return ok(bundle);
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
    const intent = decidePipPatchIntent(body);
    if (intent === "mixed") {
      return pipError(
        422,
        PIP_ERROR_CODES.mixedIntent,
        "Plan edits and outcome writes must be sent separately"
      );
    }
    if (intent === "empty") {
      return validationFailed({ body: ["Must not be empty"] });
    }
    const validation = UpdatePipSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const input = validation.data;

    let current: EmployeePip | null;
    try {
      current = await fetchPipRow(pipId);
    } catch (error) {
      console.error(
        "[performance-evaluation-pips] pip fetch failed:",
        error
      );
      return serverError();
    }
    if (current === null) return notFound("PIP not found");

    let storedPlans: EmployeePipActionPlan[];
    try {
      storedPlans = await fetchPipPlans(pipId);
    } catch (error) {
      console.error(
        "[performance-evaluation-pips] pip plans fetch failed:",
        error
      );
      return serverError();
    }

    if (intent === "outcome") {
      return handleOutcomePath(current, storedPlans, input, actorId);
    }
    return handlePlanPath(current, storedPlans, input, actorId);
  } catch (error) {
    console.error("[performance-evaluation-pips] update error:", error);
    return serverError();
  }
}
