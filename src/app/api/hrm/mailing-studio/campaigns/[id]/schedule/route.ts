import { NextRequest, NextResponse } from "next/server";

import {
    authorizeStudioCampaignsRoute,
    mapStudioCampaignsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-campaigns/server/capability";
import {
    scheduleCampaign,
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
    let body: unknown;
    try {
        body = (await req.json()) as unknown;
    } catch {
        return validationFailed({ _body: ["Request body must be valid JSON"] });
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return validationFailed({ _body: ["Request body must be a JSON object"] });
    }
    const record = body as Record<string, unknown>;
    for (const key of Object.keys(record)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
            return validationFailed({ [key]: [`Forbidden field: ${key}`] });
        }
        if (key !== "scheduled_at") {
            return validationFailed({ [key]: [`Unknown field: ${key}`] });
        }
    }
    const raw = record.scheduled_at;
    if (raw !== undefined && raw !== null && typeof raw !== "string") {
        return validationFailed({ scheduled_at: ["scheduled_at must be a datetime string or null"] });
    }
    if (typeof raw === "string" && raw.trim() === "") {
        return validationFailed({ scheduled_at: ["scheduled_at must be a valid future datetime or null"] });
    }
    const scheduledAt: string | null | undefined = raw === undefined ? undefined : raw === null ? null : raw;
    try {
        const campaign = await scheduleCampaign(id, scheduledAt, actor);
        return NextResponse.json({ success: true, data: { campaign } });
    } catch (error) {
        return toCampaignErrorResponse(error);
    }
}
