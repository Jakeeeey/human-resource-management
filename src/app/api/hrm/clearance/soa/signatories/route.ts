import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    mapClearanceSoaError,
    readSoaSignatories,
} from "@/modules/human-resource-management/clearance/hub/soa/services/ClearanceSoaService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SoaSignatoriesQuerySchema = z
    .object({
        template_id: z.coerce.number().int().positive(),
    })
    .strict();

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canViewAllClearances");
        if ("failure" in auth) return auth.failure;
        const parsed = SoaSignatoriesQuerySchema.safeParse(
            Object.fromEntries(req.nextUrl.searchParams.entries())
        );
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const signatories = await readSoaSignatories(parsed.data.template_id);
            return NextResponse.json({ success: true, data: signatories });
        } catch (error) {
            return (
                mapClearanceSoaError(error) ??
                NextResponse.json({ success: false, message: "Failed to load SOA signatories" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
