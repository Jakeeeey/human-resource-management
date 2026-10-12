import { NextRequest, NextResponse } from "next/server";

import {
    authorizeStudioGroupsRoute,
    mapStudioGroupsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/capability";
import {
    getGroup,
    softDeleteGroup,
    toGroupErrorResponse,
    updateGroup,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/groupService";
import { msGroupUpdateBodySchema } from "@/modules/human-resource-management/mailing-studio/studio-groups/types";

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
        const row = await getGroup(id);
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        return toGroupErrorResponse(error);
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let actor: string;
    try {
        const auth = await authorizeStudioGroupsRoute(req, "canManageGroups");
        if ("failure" in auth) return auth.failure;
        actor = String(auth.cap.actorId);
    } catch (error) {
        return mapStudioGroupsRouteError(error);
    }
    const { id: rawId } = await params;
    const id = parseId(rawId ?? "");
    if (id === null) {
        return validationFailed({ id: ["Group id is required"] });
    }
    const body: unknown = await req.json().catch(() => null);
    const parsed = msGroupUpdateBodySchema.safeParse(body);
    if (!parsed.success) {
        return validationFailed(parsed.error.flatten().fieldErrors);
    }
    if (Object.keys(parsed.data).length === 0) {
        return validationFailed({ _body: ["Nothing to update"] });
    }
    try {
        const row = await updateGroup(id, parsed.data, actor);
        return NextResponse.json({ success: true, data: row });
    } catch (error) {
        return toGroupErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let actor: string;
    try {
        const auth = await authorizeStudioGroupsRoute(req, "canManageGroups");
        if ("failure" in auth) return auth.failure;
        actor = String(auth.cap.actorId);
    } catch (error) {
        return mapStudioGroupsRouteError(error);
    }
    const { id: rawId } = await params;
    const id = parseId(rawId ?? "");
    if (id === null) {
        return validationFailed({ id: ["Group id is required"] });
    }
    try {
        const result = await softDeleteGroup(id, actor);
        return NextResponse.json({
            success: true,
            data: result.group,
            message: result.mode === "hard" ? "Group deleted." : "Group deactivated.",
        });
    } catch (error) {
        return toGroupErrorResponse(error);
    }
}
