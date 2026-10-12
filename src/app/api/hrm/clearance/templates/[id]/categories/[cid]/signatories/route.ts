import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    authorizeClearanceRoute,
    ClearanceCapabilityError,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/templates/server/capability";
import {
    assertPoolSigner,
    clearanceNotFound,
    getClearanceCategory,
    invalidId,
    listClearanceCategorySignatories,
    mapClearanceTemplateFailure,
    parseRouteId,
    replaceClearanceCategorySignatories,
    serverError,
    validationFailed,
} from "@/modules/human-resource-management/clearance/templates/services/ClearanceTemplateService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReplaceSignatoriesBodySchema = z
    .object({
        user_ids: z.array(z.number().int().positive()).min(1),
    })
    .strict();

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
        const category = await getClearanceCategory(cid);
        if (!category || category.template_id !== id) {
            return clearanceNotFound("Clearance category not found");
        }
        const rows = await listClearanceCategorySignatories(cid);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[clearance-signatories] list error:", error);
        return serverError();
    }
}

export async function PUT(
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
        const validation = ReplaceSignatoriesBodySchema.safeParse(body);
        if (!validation.success) {
            return validationFailed(validation.error.flatten().fieldErrors);
        }
        const category = await getClearanceCategory(cid);
        if (!category || category.template_id !== id) {
            return clearanceNotFound("Clearance category not found");
        }
        assertPoolSigner(category.signer_type);
        const rows = await replaceClearanceCategorySignatories(cid, validation.data.user_ids, auth.cap.actorId);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        if (error instanceof ClearanceCapabilityError) return mapClearanceRouteError(error);
        console.error("[clearance-signatories] replace error:", error);
        return mapClearanceTemplateFailure(error);
    }
}
