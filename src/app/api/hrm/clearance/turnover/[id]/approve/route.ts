import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    approveTurnover,
    mapClearanceTurnoverError,
} from "@/modules/human-resource-management/clearance/hub/turnover/services/ClearanceTurnoverService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ApproveTurnoverSchema = z
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
        const parsed = ApproveTurnoverSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const result = await approveTurnover({
                id,
                actorId: auth.cap.actorId,
                companyCode: parsed.data.company_code,
            });
            return NextResponse.json({
                success: true,
                data: { turnover: result.turnover, ref: result.ref },
            });
        } catch (error) {
            return (
                mapClearanceTurnoverError(error) ??
                NextResponse.json({ success: false, message: "Failed to approve turnover checklist" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
