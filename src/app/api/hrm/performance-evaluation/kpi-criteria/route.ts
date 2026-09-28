import { NextResponse, type NextRequest } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  isAbsentItemError,
  mapWriteFailure,
  nextSortOrder,
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
import { listKpiCriteria } from "@/modules/human-resource-management/performance-evaluation/server/evaluation-service";
import { EvaluationCriterionSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation.schema";
import { CreateKpiCriterionSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation-api.schema";
import {
  actorIdFromJwt,
  nowPH,
  stampCreate,
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

export async function GET(req: NextRequest) {
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
    const search = req.nextUrl.searchParams;
    const includeInactive =
      search.get("all") === "1" || search.get("include_inactive") === "1";
    return ok(await listKpiCriteria(target, includeInactive));
  } catch (error) {
    if (error instanceof EvaluationCapabilityError) return forbidden();
    console.error("[performance-evaluation][kpi-criteria] list error:", error);
    return serverError();
  }
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
    const validation = CreateKpiCriterionSchema.safeParse(body);
    if (!validation.success)
      return validationFailed(validation.error.flatten().fieldErrors);

    const existing = await listKpiCriteria(target, true);
    const sortOrder =
      existing.length > 0 ? nextSortOrder(existing) : (validation.data.sort_order ?? nextSortOrder(existing));

    const created = (await dFetch("/items/evaluation_criteria", {
      method: "POST",
      body: JSON.stringify(
        stampCreate(
          {
            ...validation.data,
            department_id: target,
            sort_order: sortOrder,
            created_at: nowPH(),
            updated_at: nowPH(),
          },
          actorId
        )
      ),
    })) as { data?: { id?: unknown }; errors?: unknown };
    if (created?.errors || typeof created?.data?.id !== "number") {
      console.error(
        "[performance-evaluation][kpi-criteria] create failed:",
        JSON.stringify(created)
      );
      return mapWriteFailure(created);
    }

    const readBack: unknown = await dFetch(
      `/items/evaluation_criteria/${created.data.id}`
    );
    if (isAbsentItemError(readBack)) return serverError();
    const parsed = EvaluationCriterionSchema.safeParse(
      unwrapData<unknown>(readBack)
    );
    if (!parsed.success) {
      console.error(
        "[performance-evaluation][kpi-criteria] created row contract mismatch:",
        JSON.stringify(parsed.error.flatten())
      );
      return serverError();
    }
    if (parsed.data.department_id !== target) return notFound();
    return ok(parsed.data, 201);
  } catch (error) {
    if (error instanceof EvaluationCapabilityError) return forbidden();
    console.error("[performance-evaluation][kpi-criteria] create error:", error);
    return serverError();
  }
}
