import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/hrm/employee-admin/employee-master-list/upload?type=profile
 * POST /api/hrm/employee-admin/employee-master-list/upload?type=signature
 *
 * Accepts multipart FormData with a `file` field.
 * Proxies to Directus /files, placing the file in the configured folder.
 * Returns the Directus file record (id, filename_disk, etc.)
 */
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? ""; // "profile" | "signature"

    // Read env vars INSIDE the handler so they're always fresh
    const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    // Folder names matching Directus
    const FOLDER_NAMES: Record<string, string> = {
      profile: "profile_images",
      signature: "employee_signatures",
      employee_file: "201_emp_files",
      hr_attachment: "hr_attachments",
    };

    if (!DIRECTUS_URL) {
      return NextResponse.json(
        { error: "Upstream API base not configured" },
        { status: 500 }
      );
    }

    // Determine target folder name based on type
    const targetFolderName = FOLDER_NAMES[type];
    let folderId: string | undefined;

    if (targetFolderName) {
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
    }

    // Receive the file from the browser
    const incomingForm = await req.formData();

    // Build the outgoing FormData for Directus
    // IMPORTANT: metadata fields (folder, title, etc.) MUST come BEFORE the file binary
    // Directus processes multipart fields sequentially — late metadata is ignored.
    const outgoingForm = new FormData();

    // 1. Folder metadata FIRST
    if (folderId) {
      outgoingForm.append("folder", folderId);
    } else {
      console.warn(`[upload] No valid folder ID resolved for type="${type}"`);
    }

    // 2. File binary AFTER metadata
    const file = incomingForm.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // --- Hard Limit Check (10MB) ---
    const MAX_FILE_SIZE = 10 * 1024 * 1024; 
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (Max 10MB)" }, { status: 413 });
    }

    outgoingForm.append("file", file);

    const response = await fetch(`${DIRECTUS_URL}/files`, {
      method: "POST",
      headers: {
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        // Do NOT set Content-Type — fetch sets multipart boundary automatically
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
