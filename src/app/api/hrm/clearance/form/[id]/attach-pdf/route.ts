import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    attachClearanceFormPdf,
    mapClearanceFormError,
} from "@/modules/human-resource-management/clearance/hub/form/services/ClearanceFormService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AttachClearanceFormPdfSchema = z
    .object({
        pdf_file_id: z.string().trim().min(1).max(255),
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
        const parsed = AttachClearanceFormPdfSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const form = await attachClearanceFormPdf(id, parsed.data.pdf_file_id, auth.cap.actorId);
            return NextResponse.json({ success: true, data: form });
        } catch (error) {
            return (
                mapClearanceFormError(error) ??
                NextResponse.json({ success: false, message: "Failed to attach clearance form PDF" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
