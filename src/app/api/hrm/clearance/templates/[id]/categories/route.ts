import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    authorizeClearanceRoute,
    ClearanceCapabilityError,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/templates/server/capability";
import {
    clearanceNotFound,
    createClearanceCategoryRows,
    getClearanceTemplate,
    invalidId,
    listClearanceCategories,
    mapClearanceTemplateFailure,
    nextSortOrder,
    parseRouteId,
    readAllFlag,
    serverError,
    validationFailed,
} from "@/modules/human-resource-management/clearance/templates/services/ClearanceTemplateService";
import { CLEARANCE_SIGNER_TYPES } from "@/modules/human-resource-management/clearance/templates/types";
import { nowUTC } from "@/modules/human-resource-management/clearance/templates/utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateTemplateCategoryBodySchema = z
    .object({
        label: z.string().trim().min(1).max(255),
        instructions: z.string().nullable().optional(),
        signer_type: z.enum(CLEARANCE_SIGNER_TYPES),
        department_id: z.number().int().positive().nullable().optional(),
        is_active: z.boolean().optional(),
        sort_order: z.number().int().optional(),
    })
    .strict();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageTemplates");
        if ("failure" in auth) return auth.failure;
        const { id: rawId } = await params;
        const id = parseRouteId(rawId);
        if (id === null) return invalidId();
        const template = await getClearanceTemplate(id);
        if (!template) return clearanceNotFound("Clearance template not found");
        const rows = await listClearanceCategories(id, { activeOnly: !readAllFlag(req) });
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[clearance-categories] list error:", error);
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
        const validation = CreateTemplateCategoryBodySchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }
        const template = await getClearanceTemplate(id);
        if (!template) return clearanceNotFound("Clearance template not found");
        if (validation.data.signer_type === "named_department" && (validation.data.department_id ?? null) === null) {
            return validationFailed({
                department_id: ["department_id is required when signer_type is named_department"],
            });
        }
        const now = nowUTC();
        const created = await createClearanceCategoryRows([
            {
                template_id: id,
                label: validation.data.label,
                instructions: validation.data.instructions ?? null,
                signer_type: validation.data.signer_type,
                department_id: validation.data.department_id ?? null,
                is_active: validation.data.is_active ?? true,
                sort_order: validation.data.sort_order ?? nextSortOrder(await listClearanceCategories(id)),
                created_at: now,
                created_by: auth.cap.actorId,
                updated_at: now,
                updated_by: auth.cap.actorId,
            },
        ]);
        return NextResponse.json({ success: true, data: created[0] ?? null }, { status: 201 });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[clearance-categories] create error:", error);
        return mapClearanceTemplateFailure(error);
    }
}
