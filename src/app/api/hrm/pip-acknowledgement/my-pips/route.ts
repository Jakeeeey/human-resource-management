import type { NextRequest } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  ok,
  readSession,
  serverError,
  unauthorized,
  unwrapData,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluationApiServer";
import { EmployeePipSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation.schema";
import { actorIdFromJwt } from "@/modules/human-resource-management/performance-evaluation/utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = readSession(req);
    if (!session) return unauthorized();
    const actorId = actorIdFromJwt(session);
    if (actorId === null) return unauthorized();

    const body: unknown = await dFetch(
      `/items/employee_pip?filter[user_id][_eq]=${actorId}&limit=-1`
    );
    const rows = unwrapData<unknown>(body);
    if (!Array.isArray(rows)) return serverError();
    const pips: unknown[] = [];
    for (const row of rows) {
      const parsed = EmployeePipSchema.safeParse(row);
      if (!parsed.success) return serverError();
      pips.push(parsed.data);
    }
    return ok(pips);
  } catch {
    return serverError();
  }
}
