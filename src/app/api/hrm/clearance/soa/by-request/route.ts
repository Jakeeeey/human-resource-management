import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    ensureSoa,
    mapClearanceSoaError,
} from "@/modules/human-resource-management/clearance/hub/soa/services/ClearanceSoaService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SoaByRequestQuerySchema = z
    .object({
        request_id: z.coerce.number().int().positive(),
    })
    .strict();

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canViewAllClearances");
        if ("failure" in auth) return auth.failure;
        const parsed = SoaByRequestQuerySchema.safeParse(
            Object.fromEntries(req.nextUrl.searchParams.entries())
        );
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const soa = await ensureSoa(parsed.data.request_id, auth.cap.actorId);
            return NextResponse.json({ success: true, data: soa });
        } catch (error) {
            return (
                mapClearanceSoaError(error) ??
                NextResponse.json({ success: false, message: "Failed to load statement of account" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
