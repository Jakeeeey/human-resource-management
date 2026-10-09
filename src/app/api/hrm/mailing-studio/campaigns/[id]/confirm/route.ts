import { NextRequest, NextResponse } from "next/server";

import {
    authorizeStudioCampaignsRoute,
    mapStudioCampaignsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/capability";
import {
    confirmCampaign,
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
        const result = await confirmCampaign(id);
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        return toCampaignErrorResponse(error);
    }
}
