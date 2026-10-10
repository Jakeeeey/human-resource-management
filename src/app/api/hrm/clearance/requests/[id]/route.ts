import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { actorIdFromJwt } from "@/modules/human-resource-management/clearance/hub/utils/audit";
import {
    getClearanceRequestDetail,
    mapClearanceRequestError,
    updateClearanceRequestTitle,
} from "@/modules/human-resource-management/clearance/hub/services/ClearanceRequestService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
    resolveClearanceCapability,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchClearanceRequestSchema = z
    .object({
        template_title_snapshot: z.string().trim().min(1).max(255),
    })
    .strict();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolved = await params;
        const id = Number(resolved.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        const token = req.cookies.get(COOKIE_NAME)?.value ?? null;
        if (!token) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }
        const actorId = actorIdFromJwt(decodeJwtPayload(token));
        if (actorId === null) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }
        let detail;
        try {
            detail = await getClearanceRequestDetail(id);
        } catch (error) {
            return (
                mapClearanceRequestError(error) ??
                NextResponse.json({ success: false, message: "Failed to load clearance request" }, { status: 500 })
            );
        }
        const cap = await resolveClearanceCapability(actorId);
        if (!cap.canManageClearances && !cap.canViewAllClearances && detail.user_id !== actorId) {
            return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
        }
        return NextResponse.json({ success: true, data: detail });
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        const resolved = await params;
        const id = Number(resolved.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        const body: unknown = await req.json().catch(() => null);
        const parsed = PatchClearanceRequestSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const detail = await updateClearanceRequestTitle(id, parsed.data.template_title_snapshot, auth.cap.actorId);
            return NextResponse.json({ success: true, data: detail });
        } catch (error) {
            return (
                mapClearanceRequestError(error) ??
                NextResponse.json({ success: false, message: "Failed to update clearance request" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
