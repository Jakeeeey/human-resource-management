import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    authorizeStudioCampaignsRoute,
    mapStudioCampaignsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/capability";
import {
    CAMPAIGNS_PAGE_DEFAULT_LIMIT,
    CAMPAIGNS_PAGE_MAX_LIMIT,
    CAMPAIGN_SORT_VALUES,
    createCampaign,
    listCampaignsPage,
    toCampaignErrorResponse,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/campaignService";
import {
    CAMPAIGN_STATUSES,
    msCampaignCreateBodySchema,
    type CampaignStatus,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const campaignsQuerySchema = z
    .object({
        page: z.coerce.number().int().min(1).max(100000).optional().default(1),
        limit: z.coerce.number().int().min(1).max(CAMPAIGNS_PAGE_MAX_LIMIT).optional().default(CAMPAIGNS_PAGE_DEFAULT_LIMIT),
        search: z.string().trim().max(200).optional(),
        sort: z.enum(CAMPAIGN_SORT_VALUES).optional().default("created-desc"),
    })
    .strict();

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json({ success: false, message: "Validation failed", errors }, { status: 400 });
}

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeStudioCampaignsRoute(req, "canViewCampaigns");
        if ("failure" in auth) return auth.failure;
    } catch (error) {
        return mapStudioCampaignsRouteError(error);
    }
    const params = req.nextUrl.searchParams;
    const raw = params.get("status");
    let status: CampaignStatus | undefined;
    if (raw !== null) {
        const value = raw.trim().toLowerCase();
        if (!(CAMPAIGN_STATUSES as readonly string[]).includes(value)) {
            return NextResponse.json(
                { success: false, message: `Invalid status filter "${raw}". Allowed values: ${CAMPAIGN_STATUSES.join(", ")}.` },
                { status: 400 }
            );
        }
        status = value as CampaignStatus;
    }
    const parsed = campaignsQuerySchema.safeParse({
        page: params.get("page") ?? undefined,
        limit: params.get("limit") ?? undefined,
        search: params.get("search") ?? undefined,
        sort: params.get("sort") ?? undefined,
    });
    if (!parsed.success) {
        return validationFailed(parsed.error.flatten().fieldErrors);
    }
    try {
        const data = await listCampaignsPage({
            page: parsed.data.page,
            limit: parsed.data.limit,
            sort: parsed.data.sort,
            ...(status === undefined ? {} : { status }),
            ...(parsed.data.search === undefined || parsed.data.search === "" ? {} : { search: parsed.data.search }),
        });
        return NextResponse.json({ success: true, data });
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
