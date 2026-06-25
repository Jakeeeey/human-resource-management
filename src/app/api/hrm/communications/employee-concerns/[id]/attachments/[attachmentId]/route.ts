import { NextResponse } from "next/server";
import { employeeConcernService } from "@/modules/human-resource-management/communications/employee-concerns/services/employee-concern";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/hrm/communications/employee-concerns/[id]/attachments/[attachmentId]
 *
 * Streams the attachment file from Directus to the client. The Directus static
 * token is used server-side only — it is never exposed to the browser. The
 * response preserves the upstream Content-Type and sets an inline
 * Content-Disposition so browsers render files (PDFs, images) directly and
 * fall back to a download for unknown types.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
    try {
        const { id: idStr, attachmentId: aidStr } = await params;
        const concernId = parseInt(idStr);
        const attachmentId = parseInt(aidStr);
        if (Number.isNaN(concernId) || Number.isNaN(attachmentId)) {
            return NextResponse.json({ error: "Invalid id" }, { status: 400 });
        }

        const attachment = await employeeConcernService.fetchAttachmentById(concernId, attachmentId);
        if (!attachment) {
            return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
        }

        const fileUrl = employeeConcernService.resolveFileUrl(attachment.file_path);
        const upstream = await fetch(fileUrl, {
            headers: { Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
        });

        if (!upstream.ok || !upstream.body) {
            console.error(`DIRECTUS ERROR [streamFile:${attachmentId}]: ${upstream.status}`);
            return NextResponse.json(
                { error: "Failed to retrieve file" },
                { status: 502 },
            );
        }

        const contentType =
            attachment.file_type ||
            upstream.headers.get("content-type") ||
            "application/octet-stream";

        // ?download=1 forces attachment disposition (Save As).
        const url = new URL(request.url);
        const forceDownload = url.searchParams.get("download") === "1";
        const disposition = forceDownload ? "attachment" : "inline";

        // Encode filename safely for the Content-Disposition header (RFC 5987).
        const safeName = attachment.file_name.replace(/[^\x20-\x7E]/g, "").replace(/"/g, "") || "file";
        const encodedName = encodeURIComponent(attachment.file_name);

        return new Response(upstream.body, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
                "Cache-Control": "private, no-store",
            },
        });
    } catch (error) {
        console.error("Attachment stream error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 },
        );
    }
}
