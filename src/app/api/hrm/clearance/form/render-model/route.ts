import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    buildClearanceFormRenderModel,
    mapClearanceFormError,
} from "@/modules/human-resource-management/clearance/form/services/ClearanceFormService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/form/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FormRenderModelQuerySchema = z
    .object({
        request_id: z.coerce.number().int().positive(),
        date: z.string().max(64).optional(),
        ref_no: z.string().max(64).optional(),
    })
    .strict();

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canViewAllClearances");
        if ("failure" in auth) return auth.failure;
        const parsed = FormRenderModelQuerySchema.safeParse(
            Object.fromEntries(req.nextUrl.searchParams.entries())
        );
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const model = await buildClearanceFormRenderModel(parsed.data.request_id, {
                date: parsed.data.date,
                refNo: parsed.data.ref_no,
            });
            return NextResponse.json({ success: true, data: model });
        } catch (error) {
            return (
                mapClearanceFormError(error) ??
                NextResponse.json({ success: false, message: "Failed to build clearance form" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
