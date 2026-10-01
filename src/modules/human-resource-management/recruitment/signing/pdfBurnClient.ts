// pdfBurnClient.ts — applicant-scoped client caller for the server-side
// pdf-lib burn.
//
// The browser NEVER flattens here: it POSTs the applicant's 201 record intent
// + renderer-owned page sizes (+ optional stamp PNG data URLs) and the server
// burns the signed strokes into the trusted admin-template PDF, then files
// upload → `data.id` → link. KEYING (todo 13 re-key): the aggregate is
// applicant-scoped, so the request/pointer carry `applicantId` as the key.

export interface PdfBurnRecordInput {
  user_id: number;
  list_id: number;
  record_name: string;
  description?: string;
}

export interface PdfBurnStampPngInput {
  stampId: string;
  pngDataUrl: string;
}

export interface RequestPdfBurnInput {
  applicantId: number;
  record: PdfBurnRecordInput;
  /** Renderer-owned bitmap size per 1-based page (fraction bridge). */
  pageSizes: Record<number, { width: number; height: number }>;
  /** Required when the document already carries a `pdf_file` (re-file). */
  reason?: string;
  /** Hiree signature PNGs, best-effort (vectors still burn without them). */
  stampPngs?: PdfBurnStampPngInput[];
}

export interface PdfBurnPointer {
  applicantId: number;
  fileId: string;
  recordId: number | null;
  version: number;
}

/**
 * Converts a stamp preview URL (`blob:` object URL) into a PNG data URL.
 * Returns null when the URL is gone (locked envelopes reloaded from the
 * server carry no preview) — the vector strokes still burn server-side.
 * @param {string | undefined} url - Stamp preview URL.
 * @returns {Promise<string | null>} PNG data URL, or null when unavailable.
 */
export async function stampPreviewToDataUrl(
  url: string | undefined
): Promise<string | null> {
  if (!url || !url.startsWith("blob:")) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0 || blob.size > 2 * 1024 * 1024) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string" ? resolve(reader.result) : resolve(null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Files a finished envelope through the server burn route.
 * @param {RequestPdfBurnInput} input - 201 record intent + page sizes.
 * @returns {Promise<PdfBurnPointer>} Pointer-only vault record.
 */
export async function requestPdfBurn(
  input: RequestPdfBurnInput
): Promise<PdfBurnPointer> {
  const res = await fetch(
    `/api/hrm/onboarding/signing-envelope/${input.applicantId}/pdf-burn`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record: input.record,
        reason: input.reason ?? undefined,
        pageSizes: input.pageSizes,
        stampPngs: input.stampPngs ?? undefined,
      }),
    }
  );
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    data?: { fileId?: string; recordId?: number | null; version?: number };
  } | null;
  if (!res.ok || !body?.success || !body.data?.fileId) {
    throw new Error(
      body?.message ?? `PDF_BURN_FAILED: burn route rejected with status ${res.status}`
    );
  }
  return {
    applicantId: input.applicantId,
    fileId: body.data.fileId,
    recordId: body.data.recordId ?? null,
    version: body.data.version ?? 1,
  };
}
