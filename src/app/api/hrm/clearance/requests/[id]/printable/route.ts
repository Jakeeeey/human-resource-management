import { NextRequest, NextResponse } from "next/server";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { actorIdFromJwt } from "@/modules/human-resource-management/clearance/filing/utils/audit";
import {
    getPrintableClearance,
    mapClearanceFilingError,
} from "@/modules/human-resource-management/clearance/filing/services/ClearanceFilingService";
import {
    mapClearanceRouteError,
    resolveClearanceCapability,
} from "@/modules/human-resource-management/clearance/filing/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        let printable;
        try {
            printable = await getPrintableClearance(id);
        } catch (error) {
            return (
                mapClearanceFilingError(error) ??
                NextResponse.json({ success: false, message: "Failed to load printable clearance" }, { status: 500 })
            );
        }
        const cap = await resolveClearanceCapability(actorId);
        if (!cap.canManageClearances && !cap.canViewAllClearances && printable.user_id !== actorId) {
            return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
        }
        return NextResponse.json({ success: true, data: printable });
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
