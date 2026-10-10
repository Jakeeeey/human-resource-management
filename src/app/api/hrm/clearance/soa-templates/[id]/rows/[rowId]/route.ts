import { NextRequest, NextResponse } from "next/server";

import {
    authorizeClearanceRoute,
    ClearanceCapabilityError,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/templates/server/capability";
import {
    invalidId,
    parseRouteId,
    serverError,
    validationFailed,
} from "@/modules/human-resource-management/clearance/templates/services/ClearanceTemplateService";
import {
    getSoaTemplateRow,
    mapSoaTemplateFailure,
    patchSoaTemplateRowRow,
    softDeleteSoaTemplateRowRow,
    soaTemplateNotFound,
} from "@/modules/human-resource-management/clearance/templates/services/SoaTemplateService";
import { SoaTemplateRowUpdateSchema } from "@/modules/human-resource-management/clearance/templates/types";
import { nowUTC } from "@/modules/human-resource-management/clearance/templates/utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadScopedRow(templateId: number, rowId: number) {
    const row = await getSoaTemplateRow(rowId);
    if (!row || row.template_id !== templateId) return null;
    return row;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string }> }
) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const { id: rawId, rowId: rawRowId } = await params;
        const id = parseRouteId(rawId);
        const rowId = parseRouteId(rawRowId);
        if (id === null || rowId === null) return invalidId();
        const row = await loadScopedRow(id, rowId);
        if (!row) return soaTemplateNotFound("SOA template row not found");
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[soa-rows] detail error:", error);
        return serverError();
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string }> }
) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const { id: rawId, rowId: rawRowId } = await params;
        const id = parseRouteId(rawId);
        const rowId = parseRouteId(rawRowId);
        if (id === null || rowId === null) return invalidId();
        const body: unknown = await req.json().catch(() => null);
        const validation = SoaTemplateRowUpdateSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }
        const current = await loadScopedRow(id, rowId);
        if (!current) return soaTemplateNotFound("SOA template row not found");
        const patch: Record<string, unknown> = {};
        if (validation.data.label !== undefined) patch.label = validation.data.label;
        if (validation.data.is_active !== undefined) patch.is_active = validation.data.is_active;
        if (validation.data.sort_order !== undefined) patch.sort_order = validation.data.sort_order;
        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ success: true, data: current });
        }
        patch.updated_at = nowUTC();
        patch.updated_by = auth.cap.actorId;
        const updated = await patchSoaTemplateRowRow(rowId, patch);
        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[soa-rows] update error:", error);
        return mapSoaTemplateFailure(error);
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; rowId: string }> }
) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const { id: rawId, rowId: rawRowId } = await params;
        const id = parseRouteId(rawId);
        const rowId = parseRouteId(rawRowId);
        if (id === null || rowId === null) return invalidId();
        const current = await loadScopedRow(id, rowId);
        if (!current) return soaTemplateNotFound("SOA template row not found");
        const soft = await softDeleteSoaTemplateRowRow(rowId, auth.cap.actorId);
        return NextResponse.json({ success: true, data: soft });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[soa-rows] delete error:", error);
        return mapSoaTemplateFailure(error);
    }
}
