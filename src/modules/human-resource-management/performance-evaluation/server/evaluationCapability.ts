import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

const HR_MODULE_BASE_PATH = "/hrm/performance-evaluation";

export interface EvaluationCapability {
  actorId: number;
  isAdmin: boolean;
  isHr: boolean;
  headOfDepartmentIds: number[];
  userDepartmentId: number | null;
  headScopeDepartmentIds: number[];
  canViewAllEmployees: boolean;
  canEvaluate: boolean;
  canFinalize: boolean;
  canManageKpiCriteria: boolean;
  canAcknowledgePip: boolean;
  visibleDepartmentIds: number[] | null;
}

export class EvaluationCapabilityError extends Error {
  readonly status = 403;
  readonly needed: string;

  constructor(needed: string) {
    super(`Forbidden: missing capability '${needed}'`);
    this.name = "EvaluationCapabilityError";
    this.needed = needed;
  }
}

interface UserRow {
  user_id?: number;
  role?: string;
  isAdmin?: boolean | number;
  user_department?: unknown;
}

interface IdRow {
  id?: number;
}

interface DepartmentHeadRow {
  department_id?: number;
}

function deniedCapability(actorId: number): EvaluationCapability {
  return {
    actorId,
    isAdmin: false,
    isHr: false,
    headOfDepartmentIds: [],
    userDepartmentId: null,
    headScopeDepartmentIds: [],
    canViewAllEmployees: false,
    canEvaluate: false,
    canFinalize: false,
    canManageKpiCriteria: false,
    canAcknowledgePip: true,
    visibleDepartmentIds: [],
  };
}

function toIdList(rows: unknown): number[] {
  if (!Array.isArray(rows)) return [];
  const ids: number[] = [];
  for (const row of rows) {
    const id = (row as IdRow).id;
    if (typeof id === "number" && Number.isInteger(id)) ids.push(id);
  }
  return ids;
}

function toDepartmentIdList(rows: unknown): number[] {
  if (!Array.isArray(rows)) return [];
  const ids: number[] = [];
  for (const row of rows) {
    const id = (row as DepartmentHeadRow).department_id;
    if (typeof id === "number" && Number.isInteger(id)) ids.push(id);
  }
  return ids;
}

function toUserDepartmentId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  if (typeof value === "object" && value !== null && "department_id" in value) {
    const id = (value as { department_id?: unknown }).department_id;
    return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null;
  }
  return null;
}

async function readUserRow(actorId: number): Promise<UserRow | null> {
  try {
    const body = (await dFetch(
      `/items/user?filter[user_id][_eq]=${actorId}&fields=user_id,role,isAdmin,user_department&limit=1`
    )) as { data?: unknown };
    const row = Array.isArray(body?.data) ? (body.data[0] as UserRow) : null;
    if (!row || typeof row !== "object") return null;
    return row;
  } catch {
    return null;
  }
}

async function readHrModuleGrant(actorId: number): Promise<boolean> {
  try {
    const encodedPath = encodeURIComponent(HR_MODULE_BASE_PATH);
    const moduleBody = (await dFetch(
      `/items/modules?filter[base_path][_eq]=${encodedPath}&fields=id&limit=1`
    )) as { data?: unknown };
    const moduleId = toIdList(moduleBody?.data)[0];
    if (moduleId === undefined) return false;
    const grantBody = (await dFetch(
      `/items/user_access_modules?filter[user_id][_eq]=${actorId}&filter[module_id][_eq]=${moduleId}&fields=id&limit=1`
    )) as { data?: unknown };
    return toIdList(grantBody?.data).length > 0;
  } catch {
    return false;
  }
}

async function readHeadDepartmentIds(actorId: number): Promise<number[]> {
  try {
    const body = (await dFetch(
      `/items/department?filter[department_head_id][_eq]=${actorId}&fields=department_id&limit=-1`
    )) as { data?: unknown };
    return toDepartmentIdList(body?.data);
  } catch {
    return [];
  }
}

export async function resolveEvaluationCapability(
  actorId: number
): Promise<EvaluationCapability> {
  if (!Number.isInteger(actorId) || actorId <= 0) {
    return deniedCapability(Number.isInteger(actorId) ? actorId : 0);
  }

  const [userRow, isHrGrant, headOfDepartmentIds] = await Promise.all([
    readUserRow(actorId),
    readHrModuleGrant(actorId),
    readHeadDepartmentIds(actorId),
  ]);

  if (!userRow) return deniedCapability(actorId);

  const isAdmin =
    userRow.role === "ADMIN" || userRow.isAdmin === 1 || userRow.isAdmin === true;
  const isHr = isHrGrant;
  const isHead = headOfDepartmentIds.length > 0;
  const userDepartmentId = toUserDepartmentId(userRow.user_department);
  const headScopeDepartmentIds =
    headOfDepartmentIds.length > 0
      ? headOfDepartmentIds
      : userDepartmentId !== null
        ? [userDepartmentId]
        : [];

  if (isAdmin) {
    return {
      actorId,
      isAdmin: true,
      isHr,
      headOfDepartmentIds,
      userDepartmentId,
      headScopeDepartmentIds,
      canViewAllEmployees: true,
      canEvaluate: true,
      canFinalize: true,
      canManageKpiCriteria: true,
      canAcknowledgePip: true,
      visibleDepartmentIds: null,
    };
  }

  const visibleDepartmentIds: number[] | null = isHr
    ? null
    : isHead
      ? headOfDepartmentIds
      : [];

  return {
    actorId,
    isAdmin: false,
    isHr,
    headOfDepartmentIds,
    userDepartmentId,
    headScopeDepartmentIds,
    canViewAllEmployees: isHr,
    canEvaluate: isHead,
    canFinalize: isHr,
    canManageKpiCriteria: isHead,
    canAcknowledgePip: true,
    visibleDepartmentIds,
  };
}

export function assertCapability(
  cap: EvaluationCapability,
  needed: keyof EvaluationCapability
): void {
  if (cap[needed] !== true) {
    throw new EvaluationCapabilityError(needed);
  }
}
