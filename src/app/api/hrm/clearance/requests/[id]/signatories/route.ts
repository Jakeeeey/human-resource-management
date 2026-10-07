import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    getRequestSignatories,
    mapClearanceSignatoryError,
    saveRequestSignatories,
} from "@/modules/human-resource-management/clearance/form/services/ClearanceSignatoryService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/form/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SaveSignatoriesSchema = z
    .object({
        assignments: z
            .array(
                z
                    .object({
                        item_id: z.number().int().positive(),
                        signatory_id: z.number().int().positive().nullable(),
                    })
                    .strict()
            )
            .min(1)
            .max(200),
    })
    .strict();

function toRequestId(value: string): number | null {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        const resolved = await params;
        const requestId = toRequestId(resolved.id);
        if (requestId === null) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const result = await getRequestSignatories(requestId);
            return NextResponse.json({ success: true, data: result });
        } catch (error) {
            return (
                mapClearanceSignatoryError(error) ??
                NextResponse.json({ success: false, message: "Failed to load signatories" }, { status: 500 })
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
        const requestId = toRequestId(resolved.id);
        if (requestId === null) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        const body: unknown = await req.json().catch(() => null);
        const parsed = SaveSignatoriesSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const items = await saveRequestSignatories(requestId, parsed.data.assignments, auth.cap.actorId);
            return NextResponse.json({ success: true, data: { items } });
        } catch (error) {
            return (
                mapClearanceSignatoryError(error) ??
                NextResponse.json({ success: false, message: "Failed to save signatories" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
