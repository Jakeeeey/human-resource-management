import { NextRequest, NextResponse } from "next/server";

import {
    authorizeStudioCampaignsRoute,
    mapStudioCampaignsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/capability";
import {
    cancelCampaign,
    toCampaignErrorResponse,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/campaignService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json({ success: false, message: "Validation failed", errors }, { status: 400 });
}

function parseId(value: string): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    try {
        const result = await cancelCampaign(id, actor);
        return NextResponse.json({ success: true, data: { campaign: result.campaign, skipped: result.skipped } });
    } catch (error) {
        return toCampaignErrorResponse(error);
    }
}
