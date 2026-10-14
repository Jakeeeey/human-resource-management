import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    createTurnover,
    mapClearanceTurnoverError,
} from "@/modules/human-resource-management/clearance/hub/turnover/services/ClearanceTurnoverService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TurnoverByRequestQuerySchema = z
    .object({
        request_id: z.coerce.number().int().positive(),
    })
    .strict();

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canViewAllClearances");
        if ("failure" in auth) return auth.failure;
        const parsed = TurnoverByRequestQuerySchema.safeParse(
            Object.fromEntries(req.nextUrl.searchParams.entries())
        );
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const turnover = await createTurnover({
                requestId: parsed.data.request_id,
                actorId: auth.cap.actorId,
            });
            return NextResponse.json({ success: true, data: turnover });
        } catch (error) {
            return (
                mapClearanceTurnoverError(error) ??
                NextResponse.json({ success: false, message: "Failed to load turnover checklist" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
