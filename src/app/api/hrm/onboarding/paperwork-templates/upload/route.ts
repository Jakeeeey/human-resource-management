import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/paperwork-templates/upload — Task 16 admin PDF
// intake for file-backed templates. PDF-only (415 otherwise, mime + magic
// bytes — a client `accept` hint alone is never trusted), 10MB cap (413),
// filed into the `paperwork_files` Directus folder, returning the file UUID
// the registry persists as `pdf_file`. Folder + cap flow mirrors
// `employee-master-list/upload` (metadata-before-binary ordering included);
// the mime gate mirrors the `application-form/upload` kind canon.
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PDF_MIME = "application/pdf";
const FOLDER_NAME = "paperwork_files";
const PDF_MAGIC = "%PDF-";

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

async function hasPdfMagic(file: Blob): Promise<boolean> {
  const head = await file.slice(0, PDF_MAGIC.length).text();
  return head === PDF_MAGIC;
}

export async function POST(req: NextRequest) {
  try {
    const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!DIRECTUS_URL) {
      return fail("Upstream API base not configured", 500);
    }

    const incomingForm = await req.formData();
    const file = incomingForm.get("file");
    if (!file || !(file instanceof Blob)) {
      return fail("No file provided", 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return fail(
        `File too large. Maximum size is 10 MB (got ${(file.size / 1024 / 1024).toFixed(2)} MB)`,
        413
      );
    }

    const mime = file instanceof File ? file.type : "";
    if (mime !== PDF_MIME) {
      return fail(
        `Invalid file type "${mime || "unknown"}". Only ${PDF_MIME} is allowed`,
        415
      );
    }
    if (!(await hasPdfMagic(file))) {
      return fail("File content is not a PDF document", 415);
    }

    let folderId: string | undefined;
    try {
      const folderRes = await fetch(
        `${DIRECTUS_URL}/folders?filter[name][_eq]=${FOLDER_NAME}&fields=id`,
        { headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {} }
      );
      if (folderRes.ok) {
        const folderData = (await folderRes.json()) as {
          data?: { id?: string }[];
        };
        if (folderData.data && folderData.data.length > 0) {
          folderId = folderData.data[0].id;
        } else {
          console.warn(`[paperwork-upload] Folder "${FOLDER_NAME}" not found in Directus.`);
        }
      } else {
        console.error(
          `[paperwork-upload] Failed to fetch folder "${FOLDER_NAME}":`,
          await folderRes.text()
        );
      }
    } catch (err) {
      console.error(`[paperwork-upload] Error fetching folder "${FOLDER_NAME}":`, err);
    }

    // Metadata fields MUST come BEFORE the file binary — Directus processes
    // multipart fields sequentially and ignores late metadata.
    const outgoingForm = new FormData();
    if (folderId) {
      outgoingForm.append("folder", folderId);
    } else {
      console.warn("[paperwork-upload] No valid folder ID resolved; uploading without folder");
    }
    outgoingForm.append("file", file);

    const response = await fetch(`${DIRECTUS_URL}/files`, {
      method: "POST",
      headers: {
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
      body: outgoingForm,
    });

    const result = (await response.json().catch(() => null)) as {
      data?: { id?: string };
      errors?: { message?: string }[];
    } | null;

    if (!response.ok) {
      console.error("[paperwork-upload] Directus upload error:", result);
      return fail(
        result?.errors?.[0]?.message || "Upload failed",
        response.status
      );
    }

    const id = result?.data?.id;
    if (!id) {
      return fail("Upload succeeded but no file id was returned", 502);
    }

    return NextResponse.json({ success: true, data: result?.data });
  } catch (error: unknown) {
    console.error("[paperwork-upload] upload error:", error);
    return fail(
      error instanceof Error ? error.message : "An unexpected error occurred. Please try again later.",
      500
    );
  }
}
