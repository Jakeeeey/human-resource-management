import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    approveSoa,
    mapClearanceSoaError,
} from "@/modules/human-resource-management/clearance/hub/soa/services/ClearanceSoaService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ApproveSoaSchema = z
    .object({
        request_id: z.number().int().positive(),
        company_code: z.string().trim().min(1).max(16),
    })
    .strict();

export async function POST(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        const body: unknown = await req.json().catch(() => null);
        const parsed = ApproveSoaSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const result = await approveSoa({
                requestId: parsed.data.request_id,
                actorId: auth.cap.actorId,
                companyCode: parsed.data.company_code,
            });
            return NextResponse.json({ success: true, data: result });
        } catch (error) {
            return (
                mapClearanceSoaError(error) ??
                NextResponse.json({ success: false, message: "Failed to approve statement of account" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
