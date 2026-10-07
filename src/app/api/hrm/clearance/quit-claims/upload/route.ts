import { NextRequest, NextResponse } from "next/server";

import { uploadIssuedQuitClaimPdf } from "@/modules/human-resource-management/clearance/hub/quit-claims/utils/issuedPdfUpload";
import {
    authorizeClearanceRoute,
    mapClearanceRouteError,
} from "@/modules/human-resource-management/clearance/hub/server/capability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PDF_MIME = "application/pdf";

function fail(message: string, status: number) {
    return NextResponse.json({ success: false, message }, { status });
}

export async function POST(req: NextRequest) {
    try {
        const auth = await authorizeClearanceRoute(req, "canManageClearances");
        if ("failure" in auth) return auth.failure;
        const incoming = await req.formData().catch(() => null);
        const file = incoming?.get("file") ?? null;
        if (!file || !(file instanceof Blob)) {
            return fail("No file provided", 400);
        }
        const mime = file instanceof File ? file.type : "";
        if (mime !== "" && mime !== PDF_MIME) {
            return fail(`Invalid file type "${mime}". Only ${PDF_MIME} is allowed`, 415);
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        const name = file instanceof File && file.name.trim() !== "" ? file.name : "issued.pdf";
        try {
            const fileId = await uploadIssuedQuitClaimPdf(bytes, name);
            return NextResponse.json({ success: true, data: { id: fileId } });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const code = message.split(":")[0];
            if (code === "CLEARANCE_QUITCLAIM_UPLOAD_INVALID_INPUT") {
                return fail("Invalid request", 400);
            }
            if (code === "CLEARANCE_QUITCLAIM_UPLOAD_FAILED") {
                if (message.includes("too large")) {
                    return fail("File too large. Maximum size is 10 MB", 413);
                }
                return fail("Upload failed", 502);
            }
            return fail("Upload failed", 500);
        }
    } catch (error) {
        return mapClearanceRouteError(error);
    }
}
