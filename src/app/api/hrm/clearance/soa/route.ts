import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    ensureSoa,
    listSoaOverview,
    mapClearanceSoaError,
} from "@/modules/human-resource-management/clearance/soa/services/ClearanceSoaService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/soa/server/capability";
import { SOA_OVERVIEW_STATUSES } from "@/modules/human-resource-management/clearance/soa/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ListSoaQuerySchema = z
    .object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
        status: z.enum(SOA_OVERVIEW_STATUSES).optional(),
    })
    .strict();

const EnsureSoaSchema = z
    .object({
        request_id: z.number().int().positive(),
    })
    .strict();

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canViewAllClearances");
        if ("failure" in auth) return auth.failure;
        const parsed = ListSoaQuerySchema.safeParse(
            Object.fromEntries(req.nextUrl.searchParams.entries())
        );
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const result = await listSoaOverview({
                page: parsed.data.page,
                limit: parsed.data.limit,
                status: parsed.data.status,
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
                mapClearanceSoaError(error) ??
                NextResponse.json({ success: false, message: "Failed to load statements of account" }, { status: 500 })
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
        const parsed = EnsureSoaSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const soa = await ensureSoa(parsed.data.request_id, auth.cap.actorId);
            return NextResponse.json({ success: true, data: soa });
        } catch (error) {
            return (
                mapClearanceSoaError(error) ??
                NextResponse.json({ success: false, message: "Failed to ensure statement of account" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
