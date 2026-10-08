import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_NAME, decodeJwtPayload, type JwtPayload } from "@/lib/auth-utils";

import { dFetch } from "../utils/directus";

const STUDIO_CAMPAIGNS_MODULE_BASE_PATH = "/hrm/mailing-studio/studio-campaigns";

export interface StudioCampaignsCapability {
    actorId: number;
    isAdmin: boolean;
    isHr: boolean;
    canManageCampaigns: boolean;
    canViewCampaigns: boolean;
}

export class StudioCampaignsCapabilityError extends Error {
    readonly status = 403;
    readonly needed: string;

    constructor(needed: string) {
        super(`Forbidden: missing capability '${needed}'`);
        this.name = "StudioCampaignsCapabilityError";
        this.needed = needed;
    }
}

interface UserRow {
    user_id?: number;
    role?: string;
    isAdmin?: boolean | number;
}

interface IdRow {
    id?: number;
}

function numericActorIdFromJwt(payload: JwtPayload | null | undefined): number | null {
    if (!payload) return null;
    const raw = payload.id ?? payload.user_id ?? payload.sub;
    if (raw === undefined || raw === null) return null;
    const id = Number(raw);
    return Number.isNaN(id) ? null : id;
}

function deniedCapability(actorId: number): StudioCampaignsCapability {
    return {
        actorId,
        isAdmin: false,
        isHr: false,
        canManageCampaigns: false,
        canViewCampaigns: false,
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

async function readUserRow(actorId: number): Promise<UserRow | null> {
    try {
        const body = (await dFetch(
            `/items/user?filter[user_id][_eq]=${actorId}&fields=user_id,role,isAdmin&limit=1`
        )) as { data?: unknown };
        const row = Array.isArray(body?.data) ? (body.data[0] as UserRow) : null;
        if (!row || typeof row !== "object") return null;
        return row;
    } catch {
        return null;
    }
}

async function readModuleGrant(actorId: number): Promise<boolean> {
    try {
        const encodedPath = encodeURIComponent(STUDIO_CAMPAIGNS_MODULE_BASE_PATH);
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

export async function resolveStudioCampaignsCapability(actorId: number): Promise<StudioCampaignsCapability> {
    if (!Number.isInteger(actorId) || actorId <= 0) {
        return deniedCapability(Number.isInteger(actorId) ? actorId : 0);
    }

    const [userRow, hasGrant] = await Promise.all([
        readUserRow(actorId),
        readModuleGrant(actorId),
    ]);

    if (!userRow) return deniedCapability(actorId);

    const isAdmin = userRow.role === "ADMIN" || userRow.isAdmin === 1 || userRow.isAdmin === true;

    if (isAdmin) {
        return {
            actorId,
            isAdmin: true,
            isHr: hasGrant,
            canManageCampaigns: true,
            canViewCampaigns: true,
        };
    }

    return {
        actorId,
        isAdmin: false,
        isHr: hasGrant,
        canManageCampaigns: hasGrant,
        canViewCampaigns: hasGrant,
    };
}

export function assertStudioCampaignsCapability(cap: StudioCampaignsCapability, needed: keyof StudioCampaignsCapability): void {
    if (cap[needed] !== true) {
        throw new StudioCampaignsCapabilityError(needed);
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

type RoutableCapability = "canManageCampaigns" | "canViewCampaigns";

type Authorization = { cap: StudioCampaignsCapability } | { failure: NextResponse };

export async function authorizeStudioCampaignsRoute(req: NextRequest, needed: RoutableCapability): Promise<Authorization> {
    const session = readSession(req);
    if (!session) return { failure: unauthorized() };
    const actorId = numericActorIdFromJwt(session);
    if (actorId === null) return { failure: unauthorized() };
    const cap = await resolveStudioCampaignsCapability(actorId);
    assertStudioCampaignsCapability(cap, needed);
    return { cap };
}

export async function authorizeStudioCampaignsRouteAny(
    req: NextRequest,
    needed: readonly RoutableCapability[]
): Promise<Authorization> {
    const session = readSession(req);
    if (!session) return { failure: unauthorized() };
    const actorId = numericActorIdFromJwt(session);
    if (actorId === null) return { failure: unauthorized() };
    const cap = await resolveStudioCampaignsCapability(actorId);
    if (!needed.some((flag) => cap[flag])) {
        throw new StudioCampaignsCapabilityError(needed[0] ?? "canManageCampaigns");
    }
    return { cap };
}

export async function enforceStudioCampaignsScope(userId: number): Promise<void> {
    const granted = await readModuleGrant(userId);
    if (!granted) {
        throw new StudioCampaignsCapabilityError("canViewCampaigns");
    }
}

export function unwrapStudioCampaignsData<T>(body: unknown): T {
    if (typeof body === "object" && body !== null && "errors" in body) {
        const errors = (body as { errors?: Array<{ message?: string }> }).errors;
        if (Array.isArray(errors) && errors.length > 0) {
            throw new Error(`STUDIO_CAMPAIGNS_READ_FAILED: ${errors.map((entry) => entry.message ?? "unknown error").join("; ")}`);
        }
    }
    if (typeof body === "object" && body !== null && "data" in body) {
        return (body as { data: T }).data;
    }
    throw new Error(`STUDIO_CAMPAIGNS_READ_FAILED: unexpected response shape (${JSON.stringify(body).slice(0, 300)})`);
}

export function mapStudioCampaignsRouteError(error: unknown): NextResponse {
    if (error instanceof StudioCampaignsCapabilityError) {
        return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    return serverError();
}
