import { NextRequest, NextResponse } from "next/server";

import {
    authorizeStudioSuppressionsRoute,
    mapStudioSuppressionsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-suppressions/server/capability";
import {
    addSuppression,
    listSuppressions,
    toSuppressionErrorResponse,
} from "@/modules/human-resource-management/mailing-studio/studio-suppressions/server/suppressionService";
import {
    SuppressionReasonSchema,
    msSuppressionCreateBodySchema,
    type SuppressionReason,
} from "@/modules/human-resource-management/mailing-studio/studio-suppressions/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json({ success: false, message: "Validation failed", errors }, { status: 400 });
}

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeStudioSuppressionsRoute(req, "canViewSuppressions");
        if ("failure" in auth) return auth.failure;
    } catch (error) {
        return mapStudioSuppressionsRouteError(error);
    }
    const raw = req.nextUrl.searchParams.get("reason");
    let reason: SuppressionReason | undefined;
    if (raw !== null) {
        const parsed = SuppressionReasonSchema.safeParse(raw.trim().toLowerCase());
        if (!parsed.success) {
            return validationFailed({ reason: ["Invalid suppression reason"] });
        }
        reason = parsed.data;
    }
    try {
        const result = await listSuppressions(reason === undefined ? undefined : { reason });
        return NextResponse.json({ success: true, data: result.rows, total: result.total });
    } catch (error) {
        return toSuppressionErrorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    let actor: string;
    try {
        const auth = await authorizeStudioSuppressionsRoute(req, "canManageSuppressions");
        if ("failure" in auth) return auth.failure;
        actor = String(auth.cap.actorId);
    } catch (error) {
        return mapStudioSuppressionsRouteError(error);
    }
    const body: unknown = await req.json().catch(() => null);
    const parsed = msSuppressionCreateBodySchema.safeParse(body);
    if (!parsed.success) {
        return validationFailed(parsed.error.flatten().fieldErrors);
    }
    try {
        const row = await addSuppression(parsed.data.email, parsed.data.reason, parsed.data.note ?? null, actor);
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        return toSuppressionErrorResponse(error);
    }
}
