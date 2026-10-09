import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    authorizeStudioGroupsRoute,
    mapStudioGroupsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/capability";
import {
    DIRECTORY_MAX_LIMIT,
    searchEmployees,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/memberDirectory";
import { toGroupErrorResponse } from "@/modules/human-resource-management/mailing-studio/studio-groups/server/groupService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const directoryQuerySchema = z
    .object({
        search: z.string().max(120).optional().default(""),
        page: z.coerce.number().int().min(1).max(10000).optional().default(1),
        limit: z.coerce.number().int().min(1).max(DIRECTORY_MAX_LIMIT).optional().default(10),
    })
    .strict();

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
    const parsed = directoryQuerySchema.safeParse({
        search: req.nextUrl.searchParams.get("search") ?? undefined,
        page: req.nextUrl.searchParams.get("page") ?? undefined,
        limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
        return validationFailed(parsed.error.flatten().fieldErrors);
    }
    try {
        const page = await searchEmployees({
            query: parsed.data.search ?? "",
            page: parsed.data.page ?? 1,
            limit: parsed.data.limit ?? 10,
        });
        return NextResponse.json({ success: true, data: page });
    } catch (error) {
        return toGroupErrorResponse(error);
    }
}
