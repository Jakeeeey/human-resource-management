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
    getSoaTemplate,
    mapSoaTemplateFailure,
    patchSoaTemplateRow,
    softDeleteSoaTemplateRow,
    soaTemplateNotFound,
} from "@/modules/human-resource-management/clearance/templates/services/SoaTemplateService";
import { SoaTemplateUpdateSchema } from "@/modules/human-resource-management/clearance/templates/types";
import { nowUTC } from "@/modules/human-resource-management/clearance/templates/utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const { id: rawId } = await params;
        const id = parseRouteId(rawId);
        if (id === null) return invalidId();
        const row = await getSoaTemplate(id);
        if (!row) return soaTemplateNotFound("SOA template not found");
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[soa-templates] detail error:", error);
        return serverError();
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const { id: rawId } = await params;
        const id = parseRouteId(rawId);
        if (id === null) return invalidId();
        const body: unknown = await req.json().catch(() => null);
        const validation = SoaTemplateUpdateSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }
        const current = await getSoaTemplate(id);
        if (!current) return soaTemplateNotFound("SOA template not found");
        const patch: Record<string, unknown> = {};
        if (validation.data.title !== undefined) patch.title = validation.data.title;
        if (validation.data.description !== undefined) patch.description = validation.data.description;
        if (validation.data.department_id !== undefined) patch.department_id = validation.data.department_id;
        if (validation.data.is_active !== undefined) patch.is_active = validation.data.is_active;
        if (validation.data.sort_order !== undefined) patch.sort_order = validation.data.sort_order;
        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ success: true, data: current });
        }
        patch.updated_at = nowUTC();
        patch.updated_by = auth.cap.actorId;
        const updated = await patchSoaTemplateRow(id, patch);
        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[soa-templates] update error:", error);
        return mapSoaTemplateFailure(error);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const { id: rawId } = await params;
        const id = parseRouteId(rawId);
        if (id === null) return invalidId();
        const current = await getSoaTemplate(id);
        if (!current) return soaTemplateNotFound("SOA template not found");
        const soft = await softDeleteSoaTemplateRow(id, auth.cap.actorId);
        return NextResponse.json({ success: true, data: soft });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[soa-templates] delete error:", error);
        return mapSoaTemplateFailure(error);
    }
}
