import { NextRequest, NextResponse } from "next/server";

import {
    authorizeClearanceRoute,
    ClearanceCapabilityError,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/templates/server/capability";
import {
    assertClearanceTemplateNotReferenced,
    clearanceNotFound,
    getClearanceTemplate,
    hardDeleteClearanceItem,
    invalidId,
    mapClearanceTemplateFailure,
    parseRouteId,
    patchClearanceTemplateRow,
    serverError,
    softDeleteClearanceTemplateRow,
    validationFailed,
} from "@/modules/human-resource-management/clearance/templates/services/ClearanceTemplateService";
import { ClearanceTemplateUpdateSchema } from "@/modules/human-resource-management/clearance/templates/types";
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
        const row = await getClearanceTemplate(id);
        if (!row) return clearanceNotFound("Clearance template not found");
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[clearance-templates] detail error:", error);
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
        const validation = ClearanceTemplateUpdateSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }
        const current = await getClearanceTemplate(id);
        if (!current) return clearanceNotFound("Clearance template not found");
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
        const updated = await patchClearanceTemplateRow(id, patch);
        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[clearance-templates] update error:", error);
        return mapClearanceTemplateFailure(error);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const { id: rawId } = await params;
        const id = parseRouteId(rawId);
        if (id === null) return invalidId();
        const current = await getClearanceTemplate(id);
        if (!current) return clearanceNotFound("Clearance template not found");
        if (req.nextUrl.searchParams.get("hard") === "1") {
            await assertClearanceTemplateNotReferenced(id);
            await hardDeleteClearanceItem("clearance_template", id);
            return NextResponse.json({ success: true, data: { id, deleted: true } });
        }
        const soft = await softDeleteClearanceTemplateRow(id, auth.cap.actorId);
        return NextResponse.json({ success: true, data: soft });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[clearance-templates] delete error:", error);
        return mapClearanceTemplateFailure(error);
    }
}
