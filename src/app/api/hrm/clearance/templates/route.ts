import { NextRequest, NextResponse } from "next/server";

import {
    authorizeClearanceRoute,
    ClearanceCapabilityError,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/templates/server/capability";
import {
    clearanceConflict,
    CLEARANCE_TEMPLATE_ERROR_CODES,
    createClearanceTemplateRow,
    findClearanceTemplateIdByCode,
    listClearanceTemplates,
    mapClearanceTemplateFailure,
    nextSortOrder,
    readAllFlag,
    serverError,
    validationFailed,
} from "@/modules/human-resource-management/clearance/templates/services/ClearanceTemplateService";
import { ClearanceTemplateCreateSchema } from "@/modules/human-resource-management/clearance/templates/types";
import { nowUTC } from "@/modules/human-resource-management/clearance/templates/utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const rows = await listClearanceTemplates({ activeOnly: !readAllFlag(req) });
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[clearance-templates] list error:", error);
        return serverError();
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const body: unknown = await req.json().catch(() => null);
        const validation = ClearanceTemplateCreateSchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }
        const duplicate = await findClearanceTemplateIdByCode(validation.data.code);
        if (duplicate !== null) {
            return clearanceConflict(
                CLEARANCE_TEMPLATE_ERROR_CODES.rowExists,
                "A template with the same code already exists"
            );
        }
        const now = nowUTC();
        const created = await createClearanceTemplateRow({
            code: validation.data.code,
            title: validation.data.title,
            description: validation.data.description ?? null,
            department_id: validation.data.department_id ?? null,
            is_active: validation.data.is_active ?? true,
            sort_order: validation.data.sort_order ?? nextSortOrder(await listClearanceTemplates()),
            created_at: now,
            created_by: auth.cap.actorId,
            updated_at: now,
            updated_by: auth.cap.actorId,
        });
        return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[clearance-templates] create error:", error);
        return mapClearanceTemplateFailure(error);
    }
}
