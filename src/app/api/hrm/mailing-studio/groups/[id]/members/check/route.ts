import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    authorizeStudioGroupsRoute,
    mapStudioGroupsRouteError,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/capability";
import {
    checkMembers,
    toGroupErrorResponse,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/groupService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const memberCheckBodySchema = z
    .object({
        emails: z.array(z.string().max(320)).max(100).optional().default([]),
        employee_refs: z.array(z.number().int()).max(100).optional().default([]),
        customer_refs: z.array(z.number().int()).max(100).optional().default([]),
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
    const body: unknown = await req.json().catch(() => null);
    const parsed = memberCheckBodySchema.safeParse(body);
    if (!parsed.success) {
        return validationFailed(parsed.error.flatten().fieldErrors);
    }
    try {
        const result = await checkMembers(id, {
            emails: parsed.data.emails ?? [],
            employeeRefs: parsed.data.employee_refs ?? [],
            customerRefs: parsed.data.customer_refs ?? [],
        });
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        return toGroupErrorResponse(error);
    }
}
