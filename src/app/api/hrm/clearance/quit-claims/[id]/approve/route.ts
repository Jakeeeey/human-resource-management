import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    approveQuitClaim,
    mapClearanceQuitClaimError,
} from "@/modules/human-resource-management/clearance/hub/quit-claims/services/ClearanceQuitClaimService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ApproveQuitClaimSchema = z
    .object({
        company_code: z.string().trim().min(1).max(16),
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
        const parsed = ApproveQuitClaimSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const result = await approveQuitClaim({
                id,
                actorId: auth.cap.actorId,
                companyCode: parsed.data.company_code,
            });
            return NextResponse.json({ success: true, data: result });
        } catch (error) {
            return (
                mapClearanceQuitClaimError(error) ??
                NextResponse.json({ success: false, message: "Failed to approve quit claim" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
