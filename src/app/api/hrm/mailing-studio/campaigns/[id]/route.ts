import { NextRequest, NextResponse } from "next/server";

import {
    authorizeStudioCampaignsRoute,
    mapStudioCampaignsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/capability";
import {
    getCampaign,
    softDeleteCampaign,
    toCampaignErrorResponse,
    updateCampaign,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/campaignService";
import { msCampaignUpdateBodySchema } from "@/modules/human-resource-management/mailing-studio/studio-campaigns/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json({ success: false, message: "Validation failed", errors }, { status: 400 });
}

function parseId(value: string): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeStudioCampaignsRoute(req, "canViewCampaigns");
        if ("failure" in auth) return auth.failure;
    } catch (error) {
        return mapStudioCampaignsRouteError(error);
    }
    const { id: rawId } = await params;
    const id = parseId(rawId ?? "");
    if (id === null) {
        return validationFailed({ id: ["Campaign id is required"] });
    }
    try {
        const row = await getCampaign(id);
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        return toCampaignErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let actor: string;
    try {
        const auth = await authorizeStudioCampaignsRoute(req, "canManageCampaigns");
        if ("failure" in auth) return auth.failure;
        actor = String(auth.cap.actorId);
    } catch (error) {
        return mapStudioCampaignsRouteError(error);
    }
    const { id: rawId } = await params;
    const id = parseId(rawId ?? "");
    if (id === null) {
        return validationFailed({ id: ["Campaign id is required"] });
    }
    const body: unknown = await req.json().catch(() => null);
    const parsed = msCampaignUpdateBodySchema.safeParse(body);
    if (!parsed.success) {
        return validationFailed(parsed.error.flatten().fieldErrors);
    }
    if (Object.keys(parsed.data).length === 0) {
        return validationFailed({ _body: ["Nothing to update"] });
    }
    try {
        const row = await updateCampaign(id, parsed.data, actor);
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        return toCampaignErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeStudioCampaignsRoute(req, "canManageCampaigns");
        if ("failure" in auth) return auth.failure;
    } catch (error) {
        return mapStudioCampaignsRouteError(error);
    }
    const { id: rawId } = await params;
    const id = parseId(rawId ?? "");
    if (id === null) {
        return validationFailed({ id: ["Campaign id is required"] });
    }
    try {
        const result = await softDeleteCampaign(id);
        return NextResponse.json({ success: true, data: result.campaign, message: "Campaign deleted." });
    } catch (error) {
        return toCampaignErrorResponse(error);
    }
}
