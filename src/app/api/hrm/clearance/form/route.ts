import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    ensureClearanceForm,
    listClearanceFormOverview,
    mapClearanceFormError,
} from "@/modules/human-resource-management/clearance/hub/form/services/ClearanceFormService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";
import { CLEARANCE_FORM_OVERVIEW_STATUSES } from "@/modules/human-resource-management/clearance/hub/form/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ListClearanceFormQuerySchema = z
    .object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
        status: z.enum(CLEARANCE_FORM_OVERVIEW_STATUSES).optional(),
    })
    .strict();

const EnsureClearanceFormSchema = z
    .object({
        request_id: z.number().int().positive(),
    })
    .strict();

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canViewAllClearances");
        if ("failure" in auth) return auth.failure;
        const parsed = ListClearanceFormQuerySchema.safeParse(
            Object.fromEntries(req.nextUrl.searchParams.entries())
        );
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const result = await listClearanceFormOverview({
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
                mapClearanceFormError(error) ??
                NextResponse.json({ success: false, message: "Failed to load clearance forms" }, { status: 500 })
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
        const parsed = EnsureClearanceFormSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const form = await ensureClearanceForm(parsed.data.request_id, auth.cap.actorId);
            return NextResponse.json({ success: true, data: form });
        } catch (error) {
            return (
                mapClearanceFormError(error) ??
                NextResponse.json({ success: false, message: "Failed to ensure clearance form" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
