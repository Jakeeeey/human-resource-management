import { NextResponse, type NextRequest } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  isAbsentItemError,
  notFound,
  ok,
  readSession,
  serverError,
  unauthorized,
  unwrapData,
  validationFailed,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluationApiServer";
import {
  EmployeePipActionPlanSchema,
  EmployeePipAreaSchema,
  EmployeePipSchema,
} from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation.schema";
import { actorIdFromJwt } from "@/modules/human-resource-management/performance-evaluation/utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pipId: string }> }
) {
  try {
    const session = readSession(req);
    if (!session) return unauthorized();
    const actorId = actorIdFromJwt(session);
    if (actorId === null) return unauthorized();

    const { pipId: pipIdParam } = await params;
    const pipId = Number(pipIdParam);
    if (!Number.isInteger(pipId) || pipId <= 0) {
      return validationFailed({ pip_id: ["Must be a positive integer"] });
    }

    const pipBody: unknown = await dFetch(`/items/employee_pip/${pipId}`);
    if (isAbsentItemError(pipBody)) return notFound("PIP not found");
    const pipParsed = EmployeePipSchema.safeParse(unwrapData<unknown>(pipBody));
    if (!pipParsed.success) return serverError();
    if (pipParsed.data.user_id !== actorId) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const [areaBody, planBody] = await Promise.all([
      dFetch(
        `/items/employee_pip_area?filter[pip_id][_eq]=${pipId}&limit=-1`
      ) as Promise<unknown>,
      dFetch(
        `/items/employee_pip_action_plan?filter[pip_id][_eq]=${pipId}&limit=-1`
      ) as Promise<unknown>,
    ]);
    const areaRows = unwrapData<unknown>(areaBody);
    const planRows = unwrapData<unknown>(planBody);
    if (!Array.isArray(areaRows) || !Array.isArray(planRows)) {
      return serverError();
    }
    const areas: unknown[] = [];
    for (const row of areaRows) {
      const parsed = EmployeePipAreaSchema.safeParse(row);
      if (!parsed.success) return serverError();
      areas.push(parsed.data);
    }
    const actionPlans: unknown[] = [];
    for (const row of planRows) {
      const parsed = EmployeePipActionPlanSchema.safeParse(row);
      if (!parsed.success) return serverError();
      actionPlans.push(parsed.data);
    }
    return ok({ pip: pipParsed.data, areas, actionPlans });
  } catch {
    return serverError();
  }
}
