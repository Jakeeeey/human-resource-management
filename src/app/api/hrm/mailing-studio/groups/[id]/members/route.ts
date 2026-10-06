import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    authorizeStudioGroupsRoute,
    mapStudioGroupsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/capability";
import {
    addMembers,
    listMembersPage,
    removeMember,
    toGroupErrorResponse,
    MEMBERS_PAGE_DEFAULT_LIMIT,
    MEMBERS_PAGE_MAX_LIMIT,
    type AddMemberInput,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/groupService";
import { msGroupMemberCreateBodySchema } from "@/modules/human-resource-management/mailing-studio/studio-groups/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const addMembersBodySchema = z
    .object({
        members: z.array(z.record(z.string(), z.unknown())).min(1, "At least one member is required"),
    })
    .strict();

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json({ success: false, message: "Validation failed", errors }, { status: 400 });
}

const membersQuerySchema = z
    .object({
        page: z.coerce.number().int().min(1).max(10000).optional().default(1),
        limit: z.coerce.number().int().min(1).max(MEMBERS_PAGE_MAX_LIMIT).optional().default(MEMBERS_PAGE_DEFAULT_LIMIT),
    })
    .strict();

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
    const parsed = membersQuerySchema.safeParse({
        page: req.nextUrl.searchParams.get("page") ?? undefined,
        limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
        return validationFailed(parsed.error.flatten().fieldErrors);
    }
    try {
        const result = await listMembersPage(id, {
            page: parsed.data.page ?? 1,
            limit: parsed.data.limit ?? MEMBERS_PAGE_DEFAULT_LIMIT,
        });
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        return toGroupErrorResponse(error);
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const shaped = addMembersBodySchema.safeParse(body);
    if (!shaped.success) {
        return validationFailed(shaped.error.flatten().fieldErrors);
    }
    const failures: Record<string, string[]> = {};
    const entries: AddMemberInput[] = [];
    shaped.data.members.forEach((entry, index) => {
        const parsed = msGroupMemberCreateBodySchema.safeParse({ ...entry, group_id: id });
        if (!parsed.success) {
            failures[`members[${index}]`] = parsed.error.issues.map(
                (issue) => `${issue.path.join(".")}: ${issue.message}`
            );
            return;
        }
        entries.push({
            email: parsed.data.email,
            source_kind: parsed.data.source_kind,
            source_ref: parsed.data.source_ref ?? null,
        });
    });
    if (Object.keys(failures).length > 0) {
        return validationFailed(failures);
    }
    try {
        const result = await addMembers(id, entries, actor);
        return NextResponse.json({
            success: true,
            data: result,
            ...(result.skipped.length > 0
                ? { message: `${result.skipped.length} duplicate address(es) skipped` }
                : {}),
        });
    } catch (error) {
        return toGroupErrorResponse(error);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeStudioGroupsRoute(req, "canManageGroups");
        if ("failure" in auth) return auth.failure;
    } catch (error) {
        return mapStudioGroupsRouteError(error);
    }
    const { id: rawId } = await params;
    const id = parseId(rawId ?? "");
    if (id === null) {
        return validationFailed({ id: ["Group id is required"] });
    }
    const memberId = parseId(req.nextUrl.searchParams.get("member_id") ?? "");
    if (memberId === null) {
        return validationFailed({ member_id: ["member_id query parameter is required"] });
    }
    try {
        await removeMember(id, memberId);
        return NextResponse.json({
            success: true,
            data: { id: memberId },
            message: "Group member removed.",
        });
    } catch (error) {
        return toGroupErrorResponse(error);
    }
}
