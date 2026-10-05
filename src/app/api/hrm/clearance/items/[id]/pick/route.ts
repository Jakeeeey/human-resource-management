import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { actorIdFromJwt } from "@/modules/human-resource-management/clearance/filing/utils/audit";
import {
    mapClearanceFilingError,
    pickClearanceSigner,
    readFilingItemRequest,
} from "@/modules/human-resource-management/clearance/filing/services/ClearanceFilingService";
import { mapClearanceRouteError } from "@/modules/human-resource-management/clearance/filing/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PickClearanceItemSchema = z
    .object({
        user_id: z.number().int().positive(),
    })
    .strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolved = await params;
        const id = Number(resolved.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        const body: unknown = await req.json().catch(() => null);
        const parsed = PickClearanceItemSchema.safeParse(body);
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
            request = await readFilingItemRequest(id);
        } catch (error) {
            return (
                mapClearanceFilingError(error) ??
                NextResponse.json({ success: false, message: "Failed to pick signer" }, { status: 500 })
            );
        }
        if (!request) {
            return NextResponse.json({ success: false, message: "Clearance item not found" }, { status: 404 });
        }
        if (request.user_id !== actorId) {
            return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
        }
        try {
            const item = await pickClearanceSigner(id, parsed.data.user_id, actorId);
            return NextResponse.json({ success: true, data: item });
        } catch (error) {
            return (
                mapClearanceFilingError(error) ??
                NextResponse.json({ success: false, message: "Failed to pick signer" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
