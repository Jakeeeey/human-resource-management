import { NextRequest, NextResponse } from "next/server";

import {
    authorizeClearanceRoute,
    ClearanceCapabilityError,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/templates/server/capability";
import {
    readAllFlag,
    serverError,
    validationFailed,
} from "@/modules/human-resource-management/clearance/templates/services/ClearanceTemplateService";
import {
    createSoaTemplateRow,
    findSoaTemplateIdByCode,
    listSoaTemplates,
    mapSoaTemplateFailure,
    nextSoaTemplateSortOrder,
    SOA_TEMPLATE_ERROR_CODES,
    soaTemplateConflict,
} from "@/modules/human-resource-management/clearance/templates/services/SoaTemplateService";
import { SoaTemplateCreateSchema } from "@/modules/human-resource-management/clearance/templates/types";
import { nowUTC } from "@/modules/human-resource-management/clearance/templates/utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const rows = await listSoaTemplates({ activeOnly: !readAllFlag(req) });
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[soa-templates] list error:", error);
        return serverError();
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const body: unknown = await req.json().catch(() => null);
        const validation = SoaTemplateCreateSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }
        const duplicate = await findSoaTemplateIdByCode(validation.data.code);
        if (duplicate !== null) {
            return soaTemplateConflict(
                SOA_TEMPLATE_ERROR_CODES.rowExists,
                "An SOA template with the same code already exists"
            );
        }
        const now = nowUTC();
        const created = await createSoaTemplateRow({
            code: validation.data.code,
            title: validation.data.title,
            description: validation.data.description ?? null,
            department_id: validation.data.department_id ?? null,
            is_active: validation.data.is_active ?? true,
            sort_order: validation.data.sort_order ?? nextSoaTemplateSortOrder(await listSoaTemplates()),
            created_at: now,
            created_by: auth.cap.actorId,
            updated_at: now,
            updated_by: auth.cap.actorId,
        });
        return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[soa-templates] create error:", error);
        return mapSoaTemplateFailure(error);
    }
}
