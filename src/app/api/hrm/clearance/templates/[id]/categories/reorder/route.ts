import { NextRequest, NextResponse } from "next/server";

import {
    authorizeClearanceRoute,
    ClearanceCapabilityError,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/templates/server/capability";
import {
    assertClearanceOrderEntriesExist,
    clearanceNotFound,
    getClearanceTemplate,
    invalidId,
    listClearanceCategories,
    mapClearanceTemplateFailure,
    parseRouteId,
    reorderClearanceCategories,
    validationFailed,
} from "@/modules/human-resource-management/clearance/templates/services/ClearanceTemplateService";
import { ClearanceReorderSchema } from "@/modules/human-resource-management/clearance/templates/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const { id: rawId } = await params;
        const id = parseRouteId(rawId);
        if (id === null) return invalidId();
        const body: unknown = await req.json().catch(() => null);
        const validation = ClearanceReorderSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }
        const template = await getClearanceTemplate(id);
        if (!template) return clearanceNotFound("Clearance template not found");
        const current = await listClearanceCategories(id);
        assertClearanceOrderEntriesExist(
            new Set(current.map((row) => row.id)),
            validation.data.order
        );
        await reorderClearanceCategories(validation.data.order, auth.cap.actorId);
        return NextResponse.json({ success: true, data: await listClearanceCategories(id) });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[clearance-categories] reorder error:", error);
        return mapClearanceTemplateFailure(error);
    }
}
