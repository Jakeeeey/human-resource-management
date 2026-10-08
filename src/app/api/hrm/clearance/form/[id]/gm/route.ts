import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    mapClearanceFormError,
    updateClearanceFormGm,
} from "@/modules/human-resource-management/clearance/hub/form/services/ClearanceFormService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateClearanceFormGmSchema = z
    .object({
        gm_name: z.string().trim().max(120).nullable(),
        gm_title: z.string().trim().max(120).nullable(),
    })
    .strict();

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
        const parsed = UpdateClearanceFormGmSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const form = await updateClearanceFormGm(
                id,
                { gmName: parsed.data.gm_name, gmTitle: parsed.data.gm_title },
                auth.cap.actorId
            );
            return NextResponse.json({ success: true, data: form });
        } catch (error) {
            return (
                mapClearanceFormError(error) ??
                NextResponse.json({ success: false, message: "Failed to update the general manager" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
