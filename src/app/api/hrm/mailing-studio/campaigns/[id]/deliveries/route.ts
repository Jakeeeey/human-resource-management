import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    authorizeStudioCampaignsRoute,
    mapStudioCampaignsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/capability";
import {
    DELIVERIES_PAGE_DEFAULT_LIMIT,
    DELIVERIES_PAGE_MAX_LIMIT,
    listCampaignDeliveriesPage,
    toCampaignErrorResponse,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/campaignService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deliveriesQuerySchema = z
    .object({
        page: z.coerce.number().int().min(1).max(100000).optional().default(1),
        limit: z.coerce
            .number()
            .int()
            .min(1)
            .max(DELIVERIES_PAGE_MAX_LIMIT)
            .optional()
            .default(DELIVERIES_PAGE_DEFAULT_LIMIT),
    })
    .strict();

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
    const parsed = deliveriesQuerySchema.safeParse({
        page: req.nextUrl.searchParams.get("page") ?? undefined,
        limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
        return validationFailed(parsed.error.flatten().fieldErrors);
    }
    try {
        const data = await listCampaignDeliveriesPage(id, {
            page: parsed.data.page,
            limit: parsed.data.limit,
        });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        return toCampaignErrorResponse(error);
    }
}
