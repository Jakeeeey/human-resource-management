import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CLEARANCE_SIGNER_TYPES } from "@/modules/human-resource-management/clearance/hub/types";
import {
    mapClearanceRequestError,
    updateClearanceItem,
} from "@/modules/human-resource-management/clearance/hub/services/ClearanceRequestService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchClearanceItemSchema = z
    .object({
        label: z.string().trim().min(1).max(255).optional(),
        signer_type: z.enum(CLEARANCE_SIGNER_TYPES).optional(),
        department_id: z.number().int().positive().nullable().optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

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
        const parsed = PatchClearanceItemSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const item = await updateClearanceItem(
                id,
                {
                    label: parsed.data.label,
                    signerType: parsed.data.signer_type,
                    departmentId: parsed.data.department_id,
                },
                auth.cap.actorId
            );
            return NextResponse.json({ success: true, data: item });
        } catch (error) {
            return (
                mapClearanceRequestError(error) ??
                NextResponse.json({ success: false, message: "Failed to update clearance item" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
