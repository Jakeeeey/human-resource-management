import { NextRequest, NextResponse } from "next/server";

import {
    getTurnover,
    mapClearanceTurnoverError,
    updateTurnoverData,
} from "@/modules/human-resource-management/clearance/hub/turnover/services/ClearanceTurnoverService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canViewAllClearances");
        if ("failure" in auth) return auth.failure;
        const resolved = await params;
        const id = Number(resolved.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const turnover = await getTurnover(id);
            return NextResponse.json({ success: true, data: turnover });
        } catch (error) {
            return (
                mapClearanceTurnoverError(error) ??
                NextResponse.json({ success: false, message: "Failed to load turnover checklist" }, { status: 500 })
            );
        }
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
        if (!isRecord(body)) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const turnover = await updateTurnoverData(id, body, auth.cap.actorId);
            return NextResponse.json({ success: true, data: turnover });
        } catch (error) {
            return (
                mapClearanceTurnoverError(error) ??
                NextResponse.json({ success: false, message: "Failed to update turnover checklist" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
