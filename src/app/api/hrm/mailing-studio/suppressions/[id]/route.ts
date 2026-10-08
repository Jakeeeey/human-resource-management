import { NextRequest, NextResponse } from "next/server";

import {
    authorizeStudioSuppressionsRoute,
    mapStudioSuppressionsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-suppressions/server/capability";
import {
    removeSuppression,
    toSuppressionErrorResponse,
} from "@/modules/human-resource-management/mailing-studio/studio-suppressions/server/suppressionService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json({ success: false, message: "Validation failed", errors }, { status: 400 });
}

function parseId(value: string): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let actor: string;
    try {
        const auth = await authorizeStudioSuppressionsRoute(req, "canManageSuppressions");
        if ("failure" in auth) return auth.failure;
        actor = String(auth.cap.actorId);
    } catch (error) {
        return mapStudioSuppressionsRouteError(error);
    }
    const { id: rawId } = await params;
    const id = parseId(rawId ?? "");
    if (id === null) {
        return validationFailed({ id: ["Suppression id is required"] });
    }
    try {
        const row = await removeSuppression(id, actor);
        return NextResponse.json({ success: true, data: row, message: "Suppression removed." });
    } catch (error) {
        return toSuppressionErrorResponse(error);
    }
}
