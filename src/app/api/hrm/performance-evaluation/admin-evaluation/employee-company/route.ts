import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/performance-evaluation/admin-evaluation/utils/directus";
import { mapRouteError } from "@/modules/human-resource-management/performance-evaluation/admin-evaluation/server/evaluation-route-guards";
import {
  isAbsentItemError,
  mapWriteFailure,
  notFound,
  ok,
  readSession,
  unauthorized,
  unwrapData,
  validationFailed,
} from "@/modules/human-resource-management/performance-evaluation/admin-evaluation/server/evaluationApiServer";
import {
  assertCapability,
  resolveEvaluationCapability,
} from "@/modules/human-resource-management/performance-evaluation/admin-evaluation/server/evaluationCapability";
import {
  actorIdFromJwt,
  stampUpdate,
} from "@/modules/human-resource-management/performance-evaluation/admin-evaluation/utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EmployeeCompanyBodySchema = z.object({
  user_id: z.number().int().positive(),
  company_id: z.number().int().positive(),
});

const CompanyIdRowSchema = z.object({
  company_id: z.number().int(),
});

const UserIdRowSchema = z.object({
  user_id: z.number().int(),
});

async function patchUserCompany(
  userId: number,
  companyId: number,
  actorId: number
): Promise<{ data?: unknown; errors?: unknown }> {
  const stamped = (await dFetch(`/items/user/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(stampUpdate({ company_id: companyId }, actorId)),
  })) as { data?: unknown; errors?: unknown };
  if (!stamped?.errors && stamped?.data) return stamped;
  if (JSON.stringify(stamped).includes("updated_by")) {
    return (await dFetch(`/items/user/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ company_id: companyId }),
    })) as { data?: unknown; errors?: unknown };
  }
  return stamped;
}

export async function PATCH(req: NextRequest) {
  try {
    const session = readSession(req);
    if (!session) return unauthorized();
    const actorId = actorIdFromJwt(session);
    if (actorId === null) return unauthorized();
    const cap = await resolveEvaluationCapability(actorId);
    assertCapability(cap, "canFinalize");

    const raw: unknown = await req.json().catch(() => null);
    const input = EmployeeCompanyBodySchema.safeParse(raw);
    if (!input.success) {
      return validationFailed({ user_id: ["Must be a positive integer"] });
    }
    const { user_id: userId, company_id: companyId } = input.data;

    const companyBody: unknown = await dFetch(
      `/items/company_list/${companyId}?fields=company_id`
    );
    if (isAbsentItemError(companyBody)) {
      return NextResponse.json(
        { success: false, message: "A referenced record does not exist" },
        { status: 400 }
      );
    }
    const companyRow = CompanyIdRowSchema.safeParse(
      unwrapData<unknown>(companyBody)
    );
    if (!companyRow.success) {
      return NextResponse.json(
        { success: false, message: "A referenced record does not exist" },
        { status: 400 }
      );
    }

    const userBody: unknown = await dFetch(
      `/items/user/${userId}?fields=user_id`
    );
    if (isAbsentItemError(userBody)) return notFound("Employee not found");
    const userRow = UserIdRowSchema.safeParse(unwrapData<unknown>(userBody));
    if (!userRow.success) return notFound("Employee not found");

    const patched = await patchUserCompany(userId, companyId, actorId);
    if (patched?.errors || !patched?.data) return mapWriteFailure(patched);
    return ok({ user_id: userId, company_id: companyId });
  } catch (error) {
    return mapRouteError(error);
  }
}
