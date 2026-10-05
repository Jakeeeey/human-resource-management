import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    mapClearanceRequestError,
    unlockClearanceItem,
} from "@/modules/human-resource-management/clearance/hub/services/ClearanceRequestService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UnlockClearanceItemSchema = z
    .object({
        reason: z.string().trim().min(1),
    })
    .strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        const resolved = await params;
        const id = Number(resolved.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        const body: unknown = await req.json().catch(() => null);
        const parsed = UnlockClearanceItemSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const item = await unlockClearanceItem(id, parsed.data.reason, auth.cap.actorId);
            return NextResponse.json({ success: true, data: item });
        } catch (error) {
            return (
                mapClearanceRequestError(error) ??
                NextResponse.json({ success: false, message: "Failed to unlock clearance item" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
