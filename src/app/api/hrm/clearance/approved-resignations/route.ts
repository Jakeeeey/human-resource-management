import { NextRequest, NextResponse } from "next/server";

import {
    listApprovedResignationsForAssignment,
    mapClearanceRequestError,
} from "@/modules/human-resource-management/clearance/hub/services/ClearanceRequestService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        try {
            const data = await listApprovedResignationsForAssignment();
            return NextResponse.json({ success: true, data });
        } catch (error) {
            return (
                mapClearanceRequestError(error) ??
                NextResponse.json({ success: false, message: "Failed to load approved resignations" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
