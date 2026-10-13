import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    approveClearanceForm,
    mapClearanceFormError,
} from "@/modules/human-resource-management/clearance/hub/form/services/ClearanceFormService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ApproveClearanceFormSchema = z
    .object({
        request_id: z.number().int().positive(),
        company_code: z.string().trim().min(1).max(16),
        date: z.string().max(64).optional(),
    })
    .strict();

export async function POST(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        const body: unknown = await req.json().catch(() => null);
        const parsed = ApproveClearanceFormSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const result = await approveClearanceForm({
                requestId: parsed.data.request_id,
                actorId: auth.cap.actorId,
                companyCode: parsed.data.company_code,
                date: parsed.data.date,
            });
            return NextResponse.json({ success: true, data: result });
        } catch (error) {
            return (
                mapClearanceFormError(error) ??
                NextResponse.json({ success: false, message: "Failed to approve clearance form" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
