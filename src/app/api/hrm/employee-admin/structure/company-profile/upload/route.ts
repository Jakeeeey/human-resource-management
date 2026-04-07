import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/hrm/employee-admin/structure/company-profile/upload
 * 
 * Accepts multipart FormData with a `file` field.
 * Proxies to Directus /files.
 * Returns the Directus file record.
 */
export async function POST(req: Request) {
    try {
        const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
        const TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

        if (!DIRECTUS_URL) {
            return NextResponse.json(
                { error: "Upstream API base not configured" },
                { status: 500 }
            );
        }

        const incomingForm = await req.formData();
        const outgoingForm = new FormData();

        // 1. Specify the folder metadata FIRST (Directus requirement)
        const targetFolderName = "hrm_assets";
        let folderId: string | undefined;

        try {
            const folderRes = await fetch(`${DIRECTUS_URL}/folders?filter[name][_eq]=${targetFolderName}`, {
              headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
            });
            if (folderRes.ok) {
              const folderData = await folderRes.json();
              if (folderData.data && folderData.data.length > 0) {
                folderId = folderData.data[0].id;
              } else {
                console.warn(`[upload] Folder "${targetFolderName}" not found in Directus.`);
              }
            } else {
              console.error(`[upload] Failed to fetch folder "${targetFolderName}":`, await folderRes.text());
            }
        } catch (err) {
            console.error(`[upload] Error fetching folder "${targetFolderName}":`, err);
        }

        if (folderId) {
            outgoingForm.append("folder", folderId);
        }

        // 2. Append the file
        const file = incomingForm.get("file");
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        outgoingForm.append("file", file as Blob);

        const response = await fetch(`${DIRECTUS_URL}/files`, {
            method: "POST",
            headers: {
                ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
            },
            body: outgoingForm,
        });

        const result = await response.json();

        if (!response.ok) {
            return NextResponse.json(result, { status: response.status });
        }

        return NextResponse.json(result);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
