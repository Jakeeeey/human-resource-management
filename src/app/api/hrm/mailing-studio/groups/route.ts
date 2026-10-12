import { NextRequest, NextResponse } from "next/server";

import {
    authorizeStudioGroupsRoute,
    mapStudioGroupsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/capability";
import {
    createGroup,
    listGroups,
    toGroupErrorResponse,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/groupService";
import { msGroupCreateBodySchema } from "@/modules/human-resource-management/mailing-studio/studio-groups/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json({ success: false, message: "Validation failed", errors }, { status: 400 });
}

export async function GET(req: NextRequest) {
    try {
        const auth = await authorizeStudioGroupsRoute(req, "canViewGroups");
        if ("failure" in auth) return auth.failure;
    } catch (error) {
        return mapStudioGroupsRouteError(error);
    }
    const raw = req.nextUrl.searchParams.get("is_active");
    let isActive: boolean | undefined;
    if (raw !== null) {
        const value = raw.trim().toLowerCase();
        if (value === "true" || value === "1") {
            isActive = true;
        } else if (value === "false" || value === "0") {
            isActive = false;
        } else {
            return NextResponse.json(
                { success: false, message: "Invalid is_active value. Expected true or false." },
                { status: 400 }
            );
        }
    }
    try {
        const rows = await listGroups(isActive === undefined ? undefined : { isActive });
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        return toGroupErrorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    let actor: string;
    try {
        const auth = await authorizeStudioGroupsRoute(req, "canManageGroups");
        if ("failure" in auth) return auth.failure;
        actor = String(auth.cap.actorId);
    } catch (error) {
        return mapStudioGroupsRouteError(error);
    }
    const body: unknown = await req.json().catch(() => null);
    const parsed = msGroupCreateBodySchema.safeParse(body);
    if (!parsed.success) {
        return validationFailed(parsed.error.flatten().fieldErrors);
    }
    try {
        const row = await createGroup(parsed.data, actor);
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        return toGroupErrorResponse(error);
    }
}
