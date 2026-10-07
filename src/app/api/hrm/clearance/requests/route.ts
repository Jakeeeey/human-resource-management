import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    assignClearanceRequest,
    listClearanceRequests,
    mapClearanceRequestError,
} from "@/modules/human-resource-management/clearance/hub/services/ClearanceRequestService";
import { ensureClearanceForm } from "@/modules/human-resource-management/clearance/form/services/ClearanceFormService";
import { ensureSoa } from "@/modules/human-resource-management/clearance/soa/services/ClearanceSoaService";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AssignClearanceRequestSchema = z
    .object({
        resignation_id: z.number().int().positive(),
        template_id: z.number().int().positive(),
    })
    .strict();

const ListClearanceRequestQuerySchema = z.object({
    status: z.enum(["pending", "in_progress", "completed"]).optional(),
    resignation_id: z.coerce.number().int().positive().optional(),
});

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canViewAllClearances");
        if ("failure" in auth) return auth.failure;
        const parsed = ListClearanceRequestQuerySchema.safeParse(
            Object.fromEntries(req.nextUrl.searchParams.entries())
        );
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const result = await listClearanceRequests({
                status: parsed.data.status,
                resignationId: parsed.data.resignation_id,
            });
            return NextResponse.json({ success: true, data: result.data, counts: result.counts });
        } catch (error) {
            return (
                mapClearanceRequestError(error) ??
                NextResponse.json({ success: false, message: "Failed to load clearance requests" }, { status: 500 })
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
        const parsed = AssignClearanceRequestSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const result = await assignClearanceRequest({
                resignationId: parsed.data.resignation_id,
                templateId: parsed.data.template_id,
                actorId: auth.cap.actorId,
            });
            try {
                await ensureClearanceForm(result.request.id, auth.cap.actorId);
            } catch (error) {
                console.error("[clearance-requests] ensure form failed:", error);
            }
            try {
                await ensureSoa(result.request.id, auth.cap.actorId);
            } catch (error) {
                console.error("[clearance-requests] ensure soa failed:", error);
            }
            return NextResponse.json(
                { success: true, data: result.request },
                { status: result.created ? 201 : 200 }
            );
        } catch (error) {
            return (
                mapClearanceRequestError(error) ??
                NextResponse.json({ success: false, message: "Failed to assign clearance" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
