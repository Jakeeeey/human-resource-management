import { NextRequest, NextResponse } from "next/server";

import {
    authorizeStudioGroupsRoute,
    mapStudioGroupsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/capability";
import {
    previewGroup,
    toGroupErrorResponse,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/groupService";

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
        const auth = await authorizeStudioGroupsRoute(req, "canViewGroups");
        if ("failure" in auth) return auth.failure;
    } catch (error) {
        return mapStudioGroupsRouteError(error);
    }
    const { id: rawId } = await params;
    const id = parseId(rawId ?? "");
    if (id === null) {
        return validationFailed({ id: ["Group id is required"] });
    }
    try {
        const result = await previewGroup(id);
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        return toGroupErrorResponse(error);
    }
}
