import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    createTurnover,
    listTurnovers,
    mapClearanceTurnoverError,
} from "@/modules/human-resource-management/clearance/hub/turnover/services/ClearanceTurnoverService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TURNOVER_STATUS_VALUES = ["pending", "approved"] as const;

const ListTurnoverQuerySchema = z
    .object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
        status: z.enum(TURNOVER_STATUS_VALUES).optional(),
        request_id: z.coerce.number().int().positive().optional(),
    })
    .strict();

const CreateTurnoverSchema = z
    .object({
        request_id: z.number().int().positive(),
    })
    .strict();

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canViewAllClearances");
        if ("failure" in auth) return auth.failure;
        const parsed = ListTurnoverQuerySchema.safeParse(
            Object.fromEntries(req.nextUrl.searchParams.entries())
        );
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const result = await listTurnovers({
                page: parsed.data.page,
                limit: parsed.data.limit,
                status: parsed.data.status,
                requestId: parsed.data.request_id,
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
                mapClearanceTurnoverError(error) ??
                NextResponse.json({ success: false, message: "Failed to load turnover checklists" }, { status: 500 })
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
        const parsed = CreateTurnoverSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const turnover = await createTurnover({
                requestId: parsed.data.request_id,
                actorId: auth.cap.actorId,
            });
            return NextResponse.json({ success: true, data: turnover }, { status: 201 });
        } catch (error) {
            return (
                mapClearanceTurnoverError(error) ??
                NextResponse.json({ success: false, message: "Failed to create turnover checklist" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
