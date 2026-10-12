import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { actorIdFromJwt } from "@/modules/human-resource-management/clearance/hub/utils/audit";
import {
    mapClearanceRequestError,
    readClearanceItemRequest,
    resolveCandidateSet,
} from "@/modules/human-resource-management/clearance/hub/services/ClearanceRequestService";
import {
    mapClearanceRouteError,
    resolveClearanceCapability,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SignatoryQuerySchema = z.object({
    item_id: z.coerce.number().int().positive(),
});

export async function GET(req: NextRequest) {
    try {
        const parsed = SignatoryQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
        if (!parsed.success) {
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
        let request;
        try {
            request = await readClearanceItemRequest(parsed.data.item_id);
        } catch (error) {
            return (
                mapClearanceRequestError(error) ??
                NextResponse.json({ success: false, message: "Failed to load signatories" }, { status: 500 })
            );
        }
        if (!request) {
            return NextResponse.json({ success: false, message: "Clearance item not found" }, { status: 404 });
        }
        const cap = await resolveClearanceCapability(actorId);
        if (!cap.canManageClearances && !cap.canViewAllClearances && request.user_id !== actorId) {
            return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
        }
        try {
            const candidates = await resolveCandidateSet(parsed.data.item_id);
            return NextResponse.json({ success: true, data: candidates });
        } catch (error) {
            return (
                mapClearanceRequestError(error) ??
                NextResponse.json({ success: false, message: "Failed to load signatories" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
