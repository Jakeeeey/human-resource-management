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

    // Folder UUIDs from .env.local
    const FOLDER_IDS: Record<string, string | undefined> = {
      profile: process.env.DIRECTUS_FOLDER_PROFILE_IMAGES,
      signature: process.env.DIRECTUS_FOLDER_EMPLOYEE_SIGNATURES,
      employee_file: "f5049617-71e1-422a-9c94-12c3ddc27d7c",
    };

    if (!DIRECTUS_URL) {
      return NextResponse.json(
        { error: "Upstream API base not configured" },
        { status: 500 }
      );
    }

    // Receive the file from the browser
    const incomingForm = await req.formData();

    // Build the outgoing FormData for Directus
    // IMPORTANT: metadata fields (folder, title, etc.) MUST come BEFORE the file binary
    // Directus processes multipart fields sequentially — late metadata is ignored.
    const outgoingForm = new FormData();

    // 1. Folder metadata FIRST
    const folderId = FOLDER_IDS[type];
    if (folderId) {
      outgoingForm.append("folder", folderId);
    } else {
      console.warn(`[upload] No folder ID for type="${type}". PROFILE=${process.env.DIRECTUS_FOLDER_PROFILE_IMAGES} SIG=${process.env.DIRECTUS_FOLDER_EMPLOYEE_SIGNATURES}`);
    }

    // 2. File binary AFTER metadata
    const file = incomingForm.get("file");
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    outgoingForm.append("file", file as Blob);

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
