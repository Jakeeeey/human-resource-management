import { NextRequest, NextResponse } from "next/server";

import {
    authorizeClearanceRoute,
    ClearanceCapabilityError,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/templates/server/capability";
import {
    invalidId,
    parseRouteId,
    validationFailed,
} from "@/modules/human-resource-management/clearance/templates/services/ClearanceTemplateService";
import {
    assertSoaTemplateOrderEntriesExist,
    getSoaTemplate,
    listSoaTemplateRows,
    mapSoaTemplateFailure,
    reorderSoaTemplateRows,
    soaTemplateNotFound,
} from "@/modules/human-resource-management/clearance/templates/services/SoaTemplateService";
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
        const template = await getSoaTemplate(id);
        if (!template) return soaTemplateNotFound("SOA template not found");
        const current = await listSoaTemplateRows(id);
        assertSoaTemplateOrderEntriesExist(
            new Set(current.map((row) => row.id)),
            validation.data.order
        );
        await reorderSoaTemplateRows(validation.data.order, auth.cap.actorId);
        return NextResponse.json({ success: true, data: await listSoaTemplateRows(id) });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[soa-rows] reorder error:", error);
        return mapSoaTemplateFailure(error);
    }
}
