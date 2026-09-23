import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { actorIdFromJwt } from "../utils/audit";
import {
  readSession,
  serverError,
  unauthorized,
  unwrapData,
} from "./evaluationApiServer";
import {
  assertCapability,
  EvaluationCapabilityError,
  resolveEvaluationCapability,
  type EvaluationCapability,
} from "./evaluationCapability";

export const EvaluationWorkspaceQuerySchema = z.object({
  user_id: z.coerce.number().int().positive(),
});

type RoutableCapability = "canViewAllEmployees" | "canEvaluate";

type Authorization =
  | { cap: EvaluationCapability }
  | { failure: NextResponse };

export async function authorizeEvaluationRoute(
  req: NextRequest,
  needed: RoutableCapability
): Promise<Authorization> {
  const session = readSession(req);
  if (!session) return { failure: unauthorized() };
  const actorId = actorIdFromJwt(session);
  if (actorId === null) return { failure: unauthorized() };
  const cap = await resolveEvaluationCapability(actorId);
  assertCapability(cap, needed);
  return { cap };
}

function toScopeDepartmentId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  if (typeof value === "object" && value !== null && "department_id" in value) {
    const id = (value as { department_id: unknown }).department_id;
    return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null;
  }
  return null;
}

export async function enforceDepartmentScope(
  userId: number,
  scopeDepartmentIds: number[] | null,
  neededFlag = "visibleDepartmentIds"
): Promise<void> {
  if (scopeDepartmentIds === null) return;
  const body: unknown = await dFetch(
    `/items/user/${userId}?fields=user_department`
  );
  const row = unwrapData<{ user_department?: unknown } | null>(body);
  const departmentId = row === null ? null : toScopeDepartmentId(row.user_department);
  if (departmentId === null || !scopeDepartmentIds.includes(departmentId)) {
    throw new EvaluationCapabilityError(neededFlag);
  }
}

export function mapRouteError(error: unknown): NextResponse {
  if (error instanceof EvaluationCapabilityError) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.status }
    );
  }
  return serverError();
}
