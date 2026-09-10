"use client";

// paperworkPdfUpload.ts — Task 16 client helper for the admin PDF intake
// route. Posts multipart `file` to `paperwork-templates/upload` and resolves
// the Directus file UUID the registry persists as `pdf_file` (extraction
// mirrors `application-form/providers/fetchProvider.ts`: `body?.data?.id`).

const BASE = "/api/hrm/onboarding/paperwork-templates/upload";

export async function uploadPaperworkPdf(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(BASE, { method: "POST", body: form });
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: { id?: string };
    message?: string;
  } | null;
  if (!res.ok || !body?.success) {
    throw new Error(body?.message || "PDF upload failed");
  }
  const id = body?.data?.id;
  if (!id) throw new Error("Upload succeeded but no file id was returned");
  return id;
}
