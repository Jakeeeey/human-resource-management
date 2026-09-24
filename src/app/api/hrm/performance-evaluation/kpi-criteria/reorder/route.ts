import { NextResponse, type NextRequest } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  isAbsentItemError,
  mapWriteFailure,
  notFound,
  ok,
  readSession,
  serverError,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluationApiServer";
import {
  EvaluationCapabilityError,
  resolveEvaluationCapability,
  type EvaluationCapability,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluationCapability";
import { listKpiCriteria } from "@/modules/human-resource-management/performance-evaluation/server/evaluation-service";
import { ReorderSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation-api.schema";
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
    if (!cap.headScopeDepartmentIds.includes(parsed)) return forbidden();
    return parsed;
  }
  const first = cap.headScopeDepartmentIds[0];
  if (first !== undefined) return first;
  return forbidden();
}

export async function POST(req: NextRequest) {
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

    const body: unknown = await req.json().catch(() => null);
    const validation = ReorderSchema.safeParse(body);
    if (!validation.success)
      return validationFailed(validation.error.flatten().fieldErrors);

    const scopedIds = new Set(
      (await listKpiCriteria(target, true)).map((criterion) => criterion.id)
    );
    for (const entry of validation.data.order) {
      if (!scopedIds.has(entry.id)) return notFound();
    }

    for (const entry of validation.data.order) {
      const result = (await dFetch(`/items/evaluation_criteria/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify(
          stampUpdate(
            { sort_order: entry.sort_order, updated_at: nowPH() },
            actorId
          )
        ),
      })) as { data?: unknown; errors?: unknown };
      if (isAbsentItemError(result)) return notFound();
      if (result?.errors) {
        console.error(
          "[performance-evaluation][kpi-criteria] reorder failed:",
          JSON.stringify(result)
        );
        return mapWriteFailure(result);
      }
    }
    return ok(await listKpiCriteria(target, true));
  } catch (error) {
    if (error instanceof EvaluationCapabilityError) return forbidden();
    console.error(
      "[performance-evaluation][kpi-criteria] reorder error:",
      error
    );
    return serverError();
  }
}
