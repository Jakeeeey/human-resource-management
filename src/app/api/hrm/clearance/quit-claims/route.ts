import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    createQuitClaim,
    listQuitClaims,
    mapClearanceQuitClaimError,
} from "@/modules/human-resource-management/clearance/quit-claims/services/ClearanceQuitClaimService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/quit-claims/server/capability";
import { QUITCLAIM_STATUSES } from "@/modules/human-resource-management/clearance/quit-claims/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ListQuitClaimQuerySchema = z
    .object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
        status: z.enum(QUITCLAIM_STATUSES).optional(),
        user_id: z.coerce.number().int().positive().optional(),
    })
    .strict();

const CreateQuitClaimSchema = z
    .object({
        user_id: z.number().int().positive(),
        resignation_id: z.number().int().positive().nullable().optional(),
        request_id: z.number().int().positive().nullable().optional(),
        company_name: z.string().trim().max(255).optional(),
    })
    .strict();

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canViewAllClearances");
        if ("failure" in auth) return auth.failure;
        const parsed = ListQuitClaimQuerySchema.safeParse(
            Object.fromEntries(req.nextUrl.searchParams.entries())
        );
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const result = await listQuitClaims({
                page: parsed.data.page,
                limit: parsed.data.limit,
                status: parsed.data.status,
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
                NextResponse.json({ success: false, message: "Failed to load quit claims" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        const body: unknown = await req.json().catch(() => null);
        const parsed = CreateQuitClaimSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const quitclaim = await createQuitClaim({
                userId: parsed.data.user_id,
                resignationId: parsed.data.resignation_id ?? null,
                requestId: parsed.data.request_id ?? null,
                companyName: parsed.data.company_name,
                actorId: auth.cap.actorId,
            });
            return NextResponse.json({ success: true, data: quitclaim }, { status: 201 });
        } catch (error) {
            return (
                mapClearanceQuitClaimError(error) ??
                NextResponse.json({ success: false, message: "Failed to create quit claim" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
