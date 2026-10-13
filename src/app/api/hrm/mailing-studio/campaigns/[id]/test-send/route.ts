import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    authorizeStudioCampaignsRoute,
    mapStudioCampaignsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/capability";
import {
    testSendCampaign,
    toCampaignErrorResponse,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/campaignService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const testSendBodySchema = z
    .object({
        seeds: z
            .array(
                z.string().trim().toLowerCase().email("Seed address must be valid").max(320, "Seed address must be at most 320 characters")
            )
            .min(1, "At least one seed address is required")
            .max(5, "At most 5 seed addresses are allowed"),
    })
    .strict();

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
    const body: unknown = await req.json().catch(() => null);
    const parsed = testSendBodySchema.safeParse(body);
    if (!parsed.success) {
        return validationFailed(parsed.error.flatten().fieldErrors);
    }
    try {
        const result = await testSendCampaign(id, parsed.data.seeds, actor);
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        return toCampaignErrorResponse(error);
    }
}
