import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    mapClearanceSoaError,
    saveSoaLines,
} from "@/modules/human-resource-management/clearance/hub/soa/services/ClearanceSoaService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";
import { SoaLineInputSchema, SoaSignatoriesSchema } from "@/modules/human-resource-management/clearance/hub/soa/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SaveSoaLinesSchema = z
    .object({
        lines: z.array(SoaLineInputSchema),
        signatories: SoaSignatoriesSchema.optional(),
    })
    .strict();

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        const resolved = await params;
        const id = Number(resolved.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        const body: unknown = await req.json().catch(() => null);
        const parsed = SaveSoaLinesSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const lines = await saveSoaLines(id, parsed.data.lines, auth.cap.actorId, parsed.data.signatories);
            return NextResponse.json({ success: true, data: lines });
        } catch (error) {
            return (
                mapClearanceSoaError(error) ??
                NextResponse.json({ success: false, message: "Failed to save SOA lines" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
