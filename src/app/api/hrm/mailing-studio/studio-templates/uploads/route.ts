import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
    DIRECTUS_URL,
    toAssetUrl,
} from "@/modules/human-resource-management/shared/utils/directus";
import {
    validateImageFileMeta,
    validateStoredImageUrl,
} from "@/modules/human-resource-management/mailing-studio/studio-templates/providers/designService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Image upload route (multipart `file` field → Directus /files → absolute
// asset URL). Envelope { success, data?: { url }, message?, errors? }
// mirrors the sibling templates/preview routes. File rules (mime allowlist,
// .svg(z) guard, 5 MiB cap) are enforced here via the shared
// designService validators — the client pre-check is UX only. The stored
// URL is re-validated absolute-URL-only (relative/cid:/data:/.svg
// rejected); http is accepted alongside https because the dev Directus
// base is http-only — an https base yields schema-satisfying https URLs.
// Never touches ms_templates or mail_outbox.

const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const directusFileSchema = z.object({
    data: z.object({
        id: z.string().min(1, "Directus file id is required"),
    }),
});

function validationFailed(errors: Record<string, string[]>) {
    return NextResponse.json(
        { success: false, message: "Validation failed", errors },
        { status: 400 },
    );
}

function unexpected(logScope: string, error: unknown) {
    console.error(logScope, error);
    return NextResponse.json(
        { success: false, message: "An unexpected error occurred. Please try again later." },
        { status: 500 },
    );
}

/**
 * Stores an image upload in Directus and returns its absolute asset URL.
 * /param req - Multipart request carrying the `file` field.
 * /returns 200 { success:true, data:{ url } }; 400 on file/URL rejects;
 * 502 when the image store or the verify-read fails; 500 when unconfigured.
 */
export async function POST(req: NextRequest) {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json(
                { success: false, message: "Image store is not configured" },
                { status: 500 },
            );
        }

        let form: FormData;
        try {
            form = await req.formData();
        } catch {
            return validationFailed({ file: ["Expected multipart/form-data with a file field"] });
        }
        const file = form.get("file");
        if (!file || !(file instanceof Blob)) {
            return validationFailed({ file: ["No file provided"] });
        }

        const metaError = validateImageFileMeta({
            name: file instanceof File ? file.name : "",
            type: file.type,
            size: file.size,
        });
        if (metaError) {
            return NextResponse.json({ success: false, message: metaError }, { status: 400 });
        }

        const outgoing = new FormData();
        outgoing.append("file", file);
        let stored: unknown;
        try {
            const uploadRes = await fetch(`${DIRECTUS_URL}/files`, {
                method: "POST",
                headers: {
                    ...(STATIC_TOKEN ? { Authorization: `Bearer ${STATIC_TOKEN}` } : {}),
                },
                body: outgoing,
            });
            if (!uploadRes.ok) {
                console.error("[mailing-studio-uploads] store error:", await uploadRes.text());
                return NextResponse.json(
                    { success: false, message: "Image store rejected the upload" },
                    { status: 502 },
                );
            }
            stored = await uploadRes.json().catch(() => null);
        } catch (error) {
            return unexpected("[mailing-studio-uploads] store error:", error);
        }
        const parsed = directusFileSchema.safeParse(stored);
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, message: "Image store returned an unreadable response" },
                { status: 502 },
            );
        }

        const url = toAssetUrl(parsed.data.data.id);
        const urlError = url ? validateStoredImageUrl(url) : "Image store returned no URL";
        if (urlError || !url) {
            return NextResponse.json(
                { success: false, message: urlError ?? "Image store returned no URL" },
                { status: 500 },
            );
        }

        try {
            const verifyRes = await fetch(url, {
                headers: {
                    ...(STATIC_TOKEN ? { Authorization: `Bearer ${STATIC_TOKEN}` } : {}),
                },
            });
            if (!verifyRes.ok) {
                console.error("[mailing-studio-uploads] verify error:", verifyRes.status);
                return NextResponse.json(
                    { success: false, message: "Uploaded file is not retrievable" },
                    { status: 502 },
                );
            }
            await verifyRes.arrayBuffer().catch(() => null);
        } catch (error) {
            return unexpected("[mailing-studio-uploads] verify error:", error);
        }

        return NextResponse.json({ success: true, data: { url } });
    } catch (error) {
        return unexpected("[mailing-studio-uploads] POST error:", error);
    }
}
