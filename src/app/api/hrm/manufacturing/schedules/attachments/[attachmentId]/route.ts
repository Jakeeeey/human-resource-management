import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

// DELETE an attachment
export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ attachmentId: string }> }
) {
    if (!DIRECTUS_URL || !TOKEN) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        const { attachmentId } = await context.params;

        // 1. Fetch the attachment record to get the file_path
        const fetchRes = await fetch(`${DIRECTUS_URL.replace(/\/+$/, "")}/items/manu_hr_schedule_attachments/${attachmentId}`, {
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json"
            }
        });

        if (!fetchRes.ok) {
            const errText = await fetchRes.text();
            throw new Error(`Failed to fetch attachment record: ${fetchRes.status} - ${errText}`);
        }

        const fetchData = await fetchRes.json();
        const attachment = fetchData.data;

        // 2. Delete the record from manu_hr_schedule_attachments
        const deleteRecordRes = await fetch(`${DIRECTUS_URL.replace(/\/+$/, "")}/items/manu_hr_schedule_attachments/${attachmentId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${TOKEN}`
            }
        });

        if (!deleteRecordRes.ok) {
            const errText = await deleteRecordRes.text();
            throw new Error(`Failed to delete attachment record: ${deleteRecordRes.status} - ${errText}`);
        }

        // 3. Attempt to delete the physical file from Directus if it's an asset
        if (attachment && attachment.file_path && attachment.file_path.startsWith('/assets/')) {
            const fileId = attachment.file_path.split('/assets/')[1].split('?')[0]; // Extract file UUID
            if (fileId) {
                // We fire and forget this deletion, because it's possible the file is shared or already gone
                fetch(`${DIRECTUS_URL.replace(/\/+$/, "")}/files/${fileId}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${TOKEN}` }
                }).catch(console.error);
            }
        }

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error("DELETE Schedule Attachment error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to delete attachment" },
            { status: 500 }
        );
    }
}
