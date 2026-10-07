import { NextRequest, NextResponse } from "next/server";

import {
    fileClearanceQuitClaimPdf,
    mapClearanceQuitClaimFilingError,
} from "@/modules/human-resource-management/clearance/hub/quit-claims/server/clearanceQuitClaimFiling";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        const resolved = await params;
        const id = Number(resolved.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 });
        }
        try {
            const result = await fileClearanceQuitClaimPdf(id);
            return NextResponse.json({
                success: true,
                data: {
                    record_id: result.recordId,
                    file_ref: result.fileRef,
                    list_id: result.listId,
                    already_filed: result.alreadyFiled,
                },
            });
        } catch (error) {
            return (
                mapClearanceQuitClaimFilingError(error) ??
                NextResponse.json({ success: false, message: "Failed to file quit claim PDF" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
