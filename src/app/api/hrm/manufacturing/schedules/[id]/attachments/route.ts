import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

// GET attachments for a specific schedule
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    if (!DIRECTUS_URL || !TOKEN) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        const { id: scheduleId } = await context.params;

        const url = `${DIRECTUS_URL.replace(/\/+$/, "")}/items/manu_hr_schedule_attachments?filter[schedule_id][_eq]=${scheduleId}&sort=-created_at`;
        
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Failed to fetch attachments: ${res.status} - ${errText}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("GET Schedule Attachments error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to fetch attachments" },
            { status: 500 }
        );
    }
}

// POST a new attachment to a specific schedule
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    if (!DIRECTUS_URL || !TOKEN) {
        return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    try {
        const { id: scheduleId } = await context.params;
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const createdBy = formData.get("userId") as string | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (file.size > 20 * 1024 * 1024) { // 20MB limit
            return NextResponse.json({ error: "File size exceeds 20MB limit" }, { status: 400 });
        }

        // 1. Upload to Directus /files
        const buffer = await file.arrayBuffer();
        const blob = new Blob([buffer], { type: file.type });

        const directusForm = new FormData();
        directusForm.append("file", blob, file.name);

        const uploadRes = await fetch(`${DIRECTUS_URL.replace(/\/+$/, "")}/files`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
            },
            body: directusForm,
        });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`Directus upload failed: ${uploadRes.status} - ${errText}`);
        }

        const uploadData = await uploadRes.json();
        const fileId = uploadData.data?.id;

        if (!fileId) {
            throw new Error("Failed to retrieve file ID from upload response");
        }

        // 2. Create record in manu_hr_schedule_attachments
        const payload = {
            schedule_id: parseInt(scheduleId, 10),
            file_name: file.name,
            file_path: `/assets/${fileId}`,
            file_type: file.type || "application/octet-stream",
            file_size_bytes: file.size,
            created_by: createdBy ? parseInt(createdBy, 10) : null
        };

        const createRes = await fetch(`${DIRECTUS_URL.replace(/\/+$/, "")}/items/manu_hr_schedule_attachments`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!createRes.ok) {
            const errText = await createRes.text();
            // Attempt to clean up the uploaded file if record creation fails
            await fetch(`${DIRECTUS_URL.replace(/\/+$/, "")}/files/${fileId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${TOKEN}` }
            }).catch(console.error);

            throw new Error(`Failed to create attachment record: ${createRes.status} - ${errText}`);
        }

        const createData = await createRes.json();

        return NextResponse.json({
            success: true,
            data: createData.data
        });
    } catch (error) {
        console.error("POST Schedule Attachment error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to upload attachment" },
            { status: 500 }
        );
    }
}
