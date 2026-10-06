import { NextRequest, NextResponse } from "next/server";

import {
    authorizeStudioCampaignsRoute,
    mapStudioCampaignsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/capability";
import {
    createCampaign,
    listCampaigns,
    toCampaignErrorResponse,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/campaignService";
import {
    CAMPAIGN_STATUSES,
    msCampaignCreateBodySchema,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/types";
import { ensureBulkDriver } from "@/modules/human-resource-management/mailing-studio/studio-outbox/server/bulk-driver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json({ success: false, message: "Validation failed", errors }, { status: 400 });
}

export async function GET(req: NextRequest) {
    ensureBulkDriver();
    try {
        const auth = await authorizeStudioCampaignsRoute(req, "canViewCampaigns");
        if ("failure" in auth) return auth.failure;
    } catch (error) {
        return mapStudioCampaignsRouteError(error);
    }
    const raw = req.nextUrl.searchParams.get("status");
    let status: (typeof CAMPAIGN_STATUSES)[number] | undefined;
    if (raw !== null) {
        const value = raw.trim().toLowerCase();
        if (!(CAMPAIGN_STATUSES as readonly string[]).includes(value)) {
            return NextResponse.json(
                { success: false, message: `Invalid status filter "${raw}". Allowed values: ${CAMPAIGN_STATUSES.join(", ")}.` },
                { status: 400 }
            );
        }
        status = value as (typeof CAMPAIGN_STATUSES)[number];
    }
    try {
        const rows = await listCampaigns(status === undefined ? undefined : { status });
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        return toCampaignErrorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    let actor: string;
    try {
        const auth = await authorizeStudioCampaignsRoute(req, "canManageCampaigns");
        if ("failure" in auth) return auth.failure;
        actor = String(auth.cap.actorId);
    } catch (error) {
        return mapStudioCampaignsRouteError(error);
    }
    const body: unknown = await req.json().catch(() => null);
    const parsed = msCampaignCreateBodySchema.safeParse(body);
    if (!parsed.success) {
        return validationFailed(parsed.error.flatten().fieldErrors);
    }
    try {
        const row = await createCampaign(parsed.data, actor);
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        return toCampaignErrorResponse(error);
    }
}
