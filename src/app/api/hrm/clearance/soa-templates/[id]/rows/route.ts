import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    authorizeClearanceRoute,
    ClearanceCapabilityError,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/templates/server/capability";
import {
    invalidId,
    parseRouteId,
    readAllFlag,
    serverError,
    validationFailed,
} from "@/modules/human-resource-management/clearance/templates/services/ClearanceTemplateService";
import {
    createSoaTemplateRowRows,
    getSoaTemplate,
    listSoaTemplateRows,
    mapSoaTemplateFailure,
    nextSoaTemplateSortOrder,
    soaTemplateNotFound,
} from "@/modules/human-resource-management/clearance/templates/services/SoaTemplateService";
import { nowUTC } from "@/modules/human-resource-management/clearance/templates/utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSoaRowBodySchema = z
    .object({
        label: z.string().trim().min(1).max(255),
    })
    .strict();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const { id: rawId } = await params;
        const id = parseRouteId(rawId);
        if (id === null) return invalidId();
        const template = await getSoaTemplate(id);
        if (!template) return soaTemplateNotFound("SOA template not found");
        const rows = await listSoaTemplateRows(id, { activeOnly: !readAllFlag(req) });
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[soa-rows] list error:", error);
        return serverError();
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const { id: rawId } = await params;
        const id = parseRouteId(rawId);
        if (id === null) return invalidId();
        const body: unknown = await req.json().catch(() => null);
        const validation = CreateSoaRowBodySchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }
        const template = await getSoaTemplate(id);
        if (!template) return soaTemplateNotFound("SOA template not found");
        const now = nowUTC();
        const created = await createSoaTemplateRowRows([
            {
                template_id: id,
                label: validation.data.label,
                is_active: true,
                sort_order: nextSoaTemplateSortOrder(await listSoaTemplateRows(id)),
                created_at: now,
                created_by: auth.cap.actorId,
                updated_at: now,
                updated_by: auth.cap.actorId,
            },
        ]);
        return NextResponse.json({ success: true, data: created[0] ?? null }, { status: 201 });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[soa-rows] create error:", error);
        return mapSoaTemplateFailure(error);
    }
}
