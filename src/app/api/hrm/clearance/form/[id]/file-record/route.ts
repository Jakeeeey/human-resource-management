import { NextRequest, NextResponse } from "next/server";

import {
    fileClearanceFormPdf,
    mapClearanceFormFilingError,
} from "@/modules/human-resource-management/clearance/hub/form/server/clearanceFormFiling";
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
            const result = await fileClearanceFormPdf(id);
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
                mapClearanceFormFilingError(error) ??
                NextResponse.json({ success: false, message: "Failed to file clearance form PDF" }, { status: 500 })
            );
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
