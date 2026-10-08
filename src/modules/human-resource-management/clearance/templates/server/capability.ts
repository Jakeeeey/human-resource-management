import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_NAME, decodeJwtPayload, type JwtPayload } from "@/lib/auth-utils";

import { dFetch } from "../utils/directus";
import { actorIdFromJwt } from "../utils/audit";

const HR_MODULE_BASE_PATH = "/hrm/clearance";

export interface ClearanceCapability {
    actorId: number;
    isAdmin: boolean;
    isHr: boolean;
    headOfDepartmentIds: number[];
    userDepartmentId: number | null;
    headScopeDepartmentIds: number[];
    canManageTemplates: boolean;
    canManageClearances: boolean;
    canViewAllClearances: boolean;
    visibleDepartmentIds: number[] | null;
}

export class ClearanceCapabilityError extends Error {
    readonly status = 403;
    readonly needed: string;

    constructor(needed: string) {
        super(`Forbidden: missing capability '${needed}'`);
        this.name = "ClearanceCapabilityError";
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

function deniedCapability(actorId: number): ClearanceCapability {
    return {
        actorId,
        isAdmin: false,
        isHr: false,
        headOfDepartmentIds: [],
        userDepartmentId: null,
        headScopeDepartmentIds: [],
        canManageTemplates: false,
        canManageClearances: false,
        canViewAllClearances: false,
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

export async function resolveClearanceCapability(actorId: number): Promise<ClearanceCapability> {
    if (!Number.isInteger(actorId) || actorId <= 0) {
        return deniedCapability(Number.isInteger(actorId) ? actorId : 0);
    }

    const [userRow, isHrGrant, headOfDepartmentIds] = await Promise.all([
        readUserRow(actorId),
        readHrModuleGrant(actorId),
        readHeadDepartmentIds(actorId),
    ]);

    if (!userRow) return deniedCapability(actorId);

    const isAdmin = userRow.role === "ADMIN" || userRow.isAdmin === 1 || userRow.isAdmin === true;
    const isHr = isHrGrant;
    const isHead = headOfDepartmentIds.length > 0;
    const userDepartmentId = toUserDepartmentId(userRow.user_department);
    const headScopeDepartmentIds = headOfDepartmentIds.length > 0
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
            canManageTemplates: true,
            canManageClearances: true,
            canViewAllClearances: true,
            visibleDepartmentIds: null,
        };
    }

    const visibleDepartmentIds: number[] | null = isHr ? null : isHead ? headOfDepartmentIds : [];

    return {
        actorId,
        isAdmin: false,
        isHr,
        headOfDepartmentIds,
        userDepartmentId,
        headScopeDepartmentIds,
        canManageTemplates: false,
        canManageClearances: isHr,
        canViewAllClearances: isHr,
        visibleDepartmentIds,
    };
}

export function assertClearanceCapability(cap: ClearanceCapability, needed: keyof ClearanceCapability): void {
    if (cap[needed] !== true) {
        throw new ClearanceCapabilityError(needed);
    }
}

function readSession(req: NextRequest): JwtPayload | null {
    const viaCookies = req.cookies.get(COOKIE_NAME)?.value;
    if (viaCookies) return decodeJwtPayload(viaCookies);
    const token = tokenFromCookieHeader(req.headers.get("cookie"));
    return token ? decodeJwtPayload(token) : null;
}

function tokenFromCookieHeader(header: string | null): string | null {
    if (!header) return null;
    for (const part of header.split(";")) {
        const separator = part.indexOf("=");
        if (separator < 0) continue;
        if (part.slice(0, separator).trim() === COOKIE_NAME) {
            const value = part.slice(separator + 1).trim();
            return value === "" ? null : value;
        }
    }
    return null;
}

function unauthorized(): NextResponse {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

function serverError(message?: string): NextResponse {
    return NextResponse.json(
        { success: false, message: message ?? "An unexpected error occurred. Please try again later." },
        { status: 500 }
    );
}

type RoutableCapability = "canManageTemplates" | "canManageClearances" | "canViewAllClearances";

type Authorization = { cap: ClearanceCapability } | { failure: NextResponse };

export async function authorizeClearanceRoute(req: NextRequest, needed: RoutableCapability): Promise<Authorization> {
    const session = readSession(req);
    if (!session) return { failure: unauthorized() };
    const actorId = actorIdFromJwt(session);
    if (actorId === null) return { failure: unauthorized() };
    const cap = await resolveClearanceCapability(actorId);
    assertClearanceCapability(cap, needed);
    return { cap };
}

export async function authorizeClearanceRouteAny(
    req: NextRequest,
    needed: readonly RoutableCapability[]
): Promise<Authorization> {
    const session = readSession(req);
    if (!session) return { failure: unauthorized() };
    const actorId = actorIdFromJwt(session);
    if (actorId === null) return { failure: unauthorized() };
    const cap = await resolveClearanceCapability(actorId);
    if (!needed.some((flag) => cap[flag])) {
        throw new ClearanceCapabilityError(needed[0] ?? "canManageClearances");
    }
    return { cap };
}

export async function enforceClearanceScope(
    userId: number,
    scopeDepartmentIds: number[] | null,
    neededFlag = "visibleDepartmentIds"
): Promise<void> {
    if (scopeDepartmentIds === null) return;
    const body: unknown = await dFetch(`/items/user/${userId}?fields=user_department`);
    const row = unwrapClearanceData<{ user_department?: unknown } | null>(body);
    const departmentId = row === null ? null : toScopeDepartmentId(row.user_department);
    if (departmentId === null || !scopeDepartmentIds.includes(departmentId)) {
        throw new ClearanceCapabilityError(neededFlag);
    }
}

function unwrapClearanceData<T>(body: unknown): T {
    if (typeof body === "object" && body !== null && "errors" in body) {
        const errors = (body as { errors?: Array<{ message?: string }> }).errors;
        if (Array.isArray(errors) && errors.length > 0) {
            throw new Error(`CLEARANCE_READ_FAILED: ${errors.map((entry) => entry.message ?? "unknown error").join("; ")}`);
        }
    }
    if (typeof body === "object" && body !== null && "data" in body) {
        return (body as { data: T }).data;
    }
    throw new Error(`CLEARANCE_READ_FAILED: unexpected response shape (${JSON.stringify(body).slice(0, 300)})`);
}

export function mapClearanceRouteError(error: unknown): NextResponse {
    if (error instanceof ClearanceCapabilityError) {
        return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    return serverError();
}
