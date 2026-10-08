import { NextRequest, NextResponse } from "next/server";

import {
    authorizeClearanceRoute,
    ClearanceCapabilityError,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/templates/server/capability";
import {
    assertClearanceCategoryNotReferenced,
    clearanceNotFound,
    getClearanceCategory,
    hardDeleteClearanceItem,
    invalidId,
    mapClearanceTemplateFailure,
    parseRouteId,
    patchClearanceCategoryRow,
    serverError,
    softDeleteClearanceCategoryRow,
    validationFailed,
} from "@/modules/human-resource-management/clearance/templates/services/ClearanceTemplateService";
import { ClearanceCategoryUpdateSchema } from "@/modules/human-resource-management/clearance/templates/types";
import { nowUTC } from "@/modules/human-resource-management/clearance/templates/utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadScopedCategory(templateId: number, categoryId: number) {
    const row = await getClearanceCategory(categoryId);
    if (!row || row.template_id !== templateId) return null;
    return row;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; cid: string }> }
) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const { id: rawId, cid: rawCid } = await params;
        const id = parseRouteId(rawId);
        const cid = parseRouteId(rawCid);
        if (id === null || cid === null) return invalidId();
        const row = await loadScopedCategory(id, cid);
        if (!row) return clearanceNotFound("Clearance category not found");
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[clearance-categories] detail error:", error);
        return serverError();
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; cid: string }> }
) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const { id: rawId, cid: rawCid } = await params;
        const id = parseRouteId(rawId);
        const cid = parseRouteId(rawCid);
        if (id === null || cid === null) return invalidId();
        const body: unknown = await req.json().catch(() => null);
        const validation = ClearanceCategoryUpdateSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }
        const current = await loadScopedCategory(id, cid);
        if (!current) return clearanceNotFound("Clearance category not found");
        const signerType = validation.data.signer_type ?? current.signer_type;
        const departmentId =
            validation.data.department_id !== undefined
                ? validation.data.department_id
                : current.department_id;
        if (signerType === "named_department" && departmentId === null) {
            return validationFailed({
                department_id: ["department_id is required when signer_type is named_department"],
            });
        }
        const patch: Record<string, unknown> = {};
        if (validation.data.label !== undefined) patch.label = validation.data.label;
        if (validation.data.instructions !== undefined) patch.instructions = validation.data.instructions;
        if (validation.data.signer_type !== undefined) patch.signer_type = validation.data.signer_type;
        if (validation.data.department_id !== undefined) patch.department_id = validation.data.department_id;
        if (validation.data.is_active !== undefined) patch.is_active = validation.data.is_active;
        if (validation.data.sort_order !== undefined) patch.sort_order = validation.data.sort_order;
        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ success: true, data: current });
        }
        patch.updated_at = nowUTC();
        patch.updated_by = auth.cap.actorId;
        const updated = await patchClearanceCategoryRow(cid, patch);
        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[clearance-categories] update error:", error);
        return mapClearanceTemplateFailure(error);
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; cid: string }> }
) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const { id: rawId, cid: rawCid } = await params;
        const id = parseRouteId(rawId);
        const cid = parseRouteId(rawCid);
        if (id === null || cid === null) return invalidId();
        const current = await loadScopedCategory(id, cid);
        if (!current) return clearanceNotFound("Clearance category not found");
        if (req.nextUrl.searchParams.get("hard") === "1") {
            await assertClearanceCategoryNotReferenced(cid);
            await hardDeleteClearanceItem("clearance_category", cid);
            return NextResponse.json({ success: true, data: { id: cid, deleted: true } });
        }
        const soft = await softDeleteClearanceCategoryRow(cid, auth.cap.actorId);
        return NextResponse.json({ success: true, data: soft });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[clearance-categories] delete error:", error);
        return mapClearanceTemplateFailure(error);
    }
}
