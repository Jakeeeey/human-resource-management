import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    mapClearanceRequestError,
    replaceItemSignatories,
} from "@/modules/human-resource-management/clearance/hub/services/ClearanceRequestService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReplaceSignatoriesSchema = z
    .object({
        user_ids: z.array(z.number().int().positive()).min(1),
    })
    .strict();

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        const resolved = await params;
        const requestId = Number(resolved.id);
        const itemId = Number(resolved.itemId);
        if (!Number.isInteger(requestId) || requestId <= 0 || !Number.isInteger(itemId) || itemId <= 0) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        const body: unknown = await req.json().catch(() => null);
        const parsed = ReplaceSignatoriesSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const rows = await replaceItemSignatories(requestId, itemId, parsed.data.user_ids, auth.cap.actorId);
            return NextResponse.json({ success: true, data: rows });
        } catch (error) {
            return (
                mapClearanceRequestError(error) ??
                NextResponse.json({ success: false, message: "Failed to replace signatories" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
