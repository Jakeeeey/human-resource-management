import { NextRequest, NextResponse } from "next/server";

import {
    getQuitClaim,
    mapClearanceQuitClaimError,
} from "@/modules/human-resource-management/clearance/quit-claims/services/ClearanceQuitClaimService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/quit-claims/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
            const quitclaim = await getQuitClaim(id);
            return NextResponse.json({ success: true, data: quitclaim });
        } catch (error) {
            return (
                mapClearanceQuitClaimError(error) ??
                NextResponse.json({ success: false, message: "Failed to load quit claim" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
