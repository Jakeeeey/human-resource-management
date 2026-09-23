import { NextResponse, type NextRequest } from "next/server";

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
import {
  EvaluationCapabilityError,
  resolveEvaluationCapability,
  type EvaluationCapability,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluationCapability";
import { EvaluationCriterionSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation.schema";
import { UpdateKpiCriterionSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation-api.schema";
import {
  actorIdFromJwt,
  nowPH,
  stampUpdate,
} from "@/modules/human-resource-management/performance-evaluation/utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function forbidden(): NextResponse {
  return NextResponse.json(
    { success: false, message: "Forbidden" },
    { status: 403 }
  );
}

function resolveTargetDepartment(
  cap: EvaluationCapability,
  req: NextRequest
): number | NextResponse {
  const raw = req.nextUrl.searchParams.get("department_id");
  if (raw !== null) {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return validationFailed({ department_id: ["Invalid department_id"] });
    }
    if (!cap.isAdmin && !cap.headScopeDepartmentIds.includes(parsed))
      return forbidden();
    return parsed;
  }
  const first = cap.headScopeDepartmentIds[0];
  if (first !== undefined) return first;
  if (cap.isAdmin && cap.userDepartmentId !== null)
    return cap.userDepartmentId;
  if (cap.isAdmin)
    return validationFailed({
      department_id: ["department_id is required"],
    });
  return forbidden();
}

async function readCriterionDepartment(
  id: number
): Promise<number | null | NextResponse> {
  const current: unknown = await dFetch(`/items/evaluation_criteria/${id}`);
  if (isAbsentItemError(current)) return notFound();
  const body = current as { data?: unknown; errors?: unknown };
  if (body?.errors || !body?.data) return serverError();
  const parsed = EvaluationCriterionSchema.safeParse(body.data);
  if (!parsed.success) return serverError();
  return parsed.data.department_id;
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
    if (!capability.canManageKpiCriteria)
      throw new EvaluationCapabilityError("canManageKpiCriteria");
    const target = resolveTargetDepartment(capability, req);
    if (target instanceof NextResponse) return target;

    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0)
      return validationFailed({ id: ["Invalid id"] });

    const body: unknown = await req.json().catch(() => null);
    const validation = UpdateKpiCriterionSchema.safeParse(body);
    if (!validation.success)
      return validationFailed(validation.error.flatten().fieldErrors);

    const owner = await readCriterionDepartment(id);
    if (owner instanceof NextResponse) return owner;
    if (owner === null || owner !== target) return notFound();

    const updated = (await dFetch(`/items/evaluation_criteria/${id}`, {
      method: "PATCH",
      body: JSON.stringify(
        stampUpdate({ ...validation.data, updated_at: nowPH() }, actorId)
      ),
    })) as { data?: unknown; errors?: unknown };
    if (isAbsentItemError(updated)) return notFound();
    if (updated?.errors || !updated?.data) {
      console.error(
        "[performance-evaluation][kpi-criteria] update failed:",
        JSON.stringify(updated)
      );
      return mapWriteFailure(updated);
    }

    const readBack: unknown = await dFetch(`/items/evaluation_criteria/${id}`);
    if (isAbsentItemError(readBack)) return notFound();
    const parsed = EvaluationCriterionSchema.safeParse(
      unwrapData<unknown>(readBack)
    );
    if (!parsed.success) {
      console.error(
        "[performance-evaluation][kpi-criteria] updated row contract mismatch:",
        JSON.stringify(parsed.error.flatten())
      );
      return serverError();
    }
    return ok(parsed.data);
  } catch (error) {
    if (error instanceof EvaluationCapabilityError) return forbidden();
    console.error("[performance-evaluation][kpi-criteria] update error:", error);
    return serverError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = readSession(req);
    if (!session) return unauthorized();
    const actorId = actorIdFromJwt(session);
    if (actorId === null) return unauthorized();
    const capability = await resolveEvaluationCapability(actorId);
    if (!capability.canManageKpiCriteria)
      throw new EvaluationCapabilityError("canManageKpiCriteria");
    const target = resolveTargetDepartment(capability, req);
    if (target instanceof NextResponse) return target;

    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0)
      return validationFailed({ id: ["Invalid id"] });

    const owner = await readCriterionDepartment(id);
    if (owner instanceof NextResponse) return owner;
    if (owner === null || owner !== target) return notFound();

    const references: unknown = await dFetch(
      `/items/employee_evaluation_item?filter[criterion_id][_eq]=${id}&fields=id&limit=1`
    );
    const referenceRows = unwrapData<unknown>(references);
    if (Array.isArray(referenceRows) && referenceRows.length > 0) {
      return evaluationError(
        409,
        EVALUATION_ERROR_CODES.rowExists,
        "This KPI criterion is referenced by existing records and cannot be deleted."
      );
    }

    const deleted: unknown = await dFetch(`/items/evaluation_criteria/${id}`, {
      method: "DELETE",
    });
    if (isAbsentItemError(deleted)) return notFound();
    if (
      deleted !== null &&
      typeof deleted === "object" &&
      "errors" in deleted
    ) {
      console.error(
        "[performance-evaluation][kpi-criteria] delete failed:",
        JSON.stringify(deleted)
      );
      return mapWriteFailure(deleted);
    }
    return ok({ id });
  } catch (error) {
    if (error instanceof EvaluationCapabilityError) return forbidden();
    console.error("[performance-evaluation][kpi-criteria] delete error:", error);
    return serverError();
  }
}
