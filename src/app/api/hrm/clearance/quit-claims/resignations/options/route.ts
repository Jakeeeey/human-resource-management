import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    listResignationOptions,
    mapClearanceQuitClaimError,
} from "@/modules/human-resource-management/clearance/quit-claims/services/ClearanceQuitClaimService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/quit-claims/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ResignationOptionsQuerySchema = z
    .object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
        user_id: z.coerce.number().int().positive().optional(),
    })
    .strict();

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canViewAllClearances");
        if ("failure" in auth) return auth.failure;
        const parsed = ResignationOptionsQuerySchema.safeParse(
            Object.fromEntries(req.nextUrl.searchParams.entries())
        );
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const result = await listResignationOptions({
                page: parsed.data.page,
                limit: parsed.data.limit,
                userId: parsed.data.user_id,
            });
            return NextResponse.json({
                success: true,
                data: result.data,
                total: result.total,
                page: result.page,
                limit: result.limit,
            });
        } catch (error) {
            return (
                mapClearanceQuitClaimError(error) ??
                NextResponse.json({ success: false, message: "Failed to load resignations" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
