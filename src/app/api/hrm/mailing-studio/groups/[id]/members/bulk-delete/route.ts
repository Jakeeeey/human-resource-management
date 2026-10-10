import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    authorizeStudioGroupsRoute,
    mapStudioGroupsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/capability";
import {
    removeMembers,
    removeMembersByFilter,
    toGroupErrorResponse,
    BULK_DELETE_MAX_IDS,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/groupService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bulkDeleteBodySchema = z
    .object({
        member_ids: z
            .array(z.number().int().positive())
            .min(1, "Select at least one member")
            .max(BULK_DELETE_MAX_IDS, `At most ${BULK_DELETE_MAX_IDS} members can be removed per request`)
            .optional(),
        filter: z
            .object({
                search: z.string().max(120).optional(),
            })
            .strict()
            .optional(),
    })
    .strict()
    .refine((body) => (body.member_ids !== undefined) !== (body.filter !== undefined), {
        message: "Provide either member_ids or filter, but not both",
    });

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json({ success: false, message: "Validation failed", errors }, { status: 400 });
}

function parseId(value: string): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const body: unknown = await req.json().catch(() => null);
    const shaped = bulkDeleteBodySchema.safeParse(body);
    if (!shaped.success) {
        const flat = shaped.error.flatten();
        const errors: Record<string, string[]> = {};
        for (const [key, messages] of Object.entries(flat.fieldErrors)) {
            if (messages) errors[key] = messages;
        }
        if (flat.formErrors.length > 0) errors.form = flat.formErrors;
        return validationFailed(errors);
    }
    try {
        const result =
            shaped.data.member_ids !== undefined
                ? await removeMembers(id, shaped.data.member_ids)
                : await removeMembersByFilter(id, { search: shaped.data.filter?.search ?? "" });
        const removedCount = result.removed.length;
        const notFoundCount = result.notFound.length;
        const message =
            removedCount > 0
                ? `${removedCount} member${removedCount === 1 ? "" : "s"} removed${notFoundCount > 0 ? `, ${notFoundCount} no longer in this group` : ""}.`
                : "No members were removed — none of the selected members are in this group.";
        return NextResponse.json({ success: true, data: result, message });
    } catch (error) {
        return toGroupErrorResponse(error);
    }
}
