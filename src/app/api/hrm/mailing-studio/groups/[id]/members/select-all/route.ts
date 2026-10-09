import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    authorizeStudioGroupsRoute,
    mapStudioGroupsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/capability";
import {
    selectAllMembers,
    toGroupErrorResponse,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/groupService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const selectAllBodySchema = z
    .object({
        source_kind: z.enum(["employee", "customer"]),
        search: z.string().max(120).optional().default(""),
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
    const shaped = selectAllBodySchema.safeParse(body);
    if (!shaped.success) {
        return validationFailed(shaped.error.flatten().fieldErrors);
    }
    try {
        const result = await selectAllMembers(
            id,
            { sourceKind: shaped.data.source_kind, query: shaped.data.search ?? "" },
            actor
        );
        const addedCount = result.added.length;
        const skippedCount = result.skipped.length;
        const message =
            addedCount > 0 && skippedCount > 0
                ? `${addedCount} member${addedCount === 1 ? "" : "s"} added, ${skippedCount} skipped (already in this group or without a usable email)`
                : addedCount > 0
                  ? `${addedCount} member${addedCount === 1 ? "" : "s"} added`
                  : "Nothing to add — every matching address is already in this group or has no usable email.";
        return NextResponse.json({
            success: true,
            data: { added: result.added, skipped: result.skipped },
            message,
        });
    } catch (error) {
        return toGroupErrorResponse(error);
    }
}
