import { NextRequest, NextResponse } from "next/server";

import {
    confirmClearanceRequest,
    mapClearanceRequestError,
} from "@/modules/human-resource-management/clearance/hub/services/ClearanceRequestService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        const resolved = await params;
        const id = Number(resolved.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const detail = await confirmClearanceRequest(id, auth.cap.actorId);
            return NextResponse.json({ success: true, data: detail });
        } catch (error) {
            return (
                mapClearanceRequestError(error) ??
                NextResponse.json({ success: false, message: "Failed to confirm clearance" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
