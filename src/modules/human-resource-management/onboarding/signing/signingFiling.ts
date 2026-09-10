// signingFiling.ts — Todo 8 client filing orchestrator (browser only).
//
// Write order (enforced): upload → persist returned `data.id` → link.
// Upload goes ONLY through the existing `?type=employee_file` route
// (validation reused, never re-implemented — 413s surface with reason).
// The link step hits the onboarding file route (server-side Directus;
// DIRECTUS_STATIC_TOKEN never reaches the browser). `file_ref` is never
// linked before the upload UUID exists — the type flow makes it
// unrepresentable (`persistUploadId` throws on empty ids).

import {
  buildFilingFilename,
  confirmLink,
  markOrphaned,
  persistUploadId,
  stageFiling,
  type StagedFiling,
  type VaultPointer,
} from "./signingVault";
import { assertUnderCapOrThrow } from "./signingFlatten";

const UPLOAD_URL =
  "/api/hrm/employee-admin/employee-master-list/upload?type=employee_file";

export interface FilingRecordInput {
  user_id: number;
  list_id: number;
  record_name: string;
  description?: string;
}

export interface FileFinishedEnvelopeInput {
  envelopeId: number;
  envelopeKey: string;
  pdfBytes: Uint8Array;
  record: FilingRecordInput;
  /** Required when the envelope already carries a `pdf_file` (re-file). */
  reason?: string;
  version?: number;
}

/**
 * Uploads filed PDF bytes through the EXISTING employee-file route.
 * @param {Uint8Array} pdfBytes - Flattened PDF bytes (already 413-guarded).
 * @param {string} filename - Vault filename.
 * @returns {Promise<string>} Directus file UUID (`data.id`).
 */
export async function uploadFiledPdf(
  pdfBytes: Uint8Array,
  filename: string
): Promise<string> {
  const blob = new Blob([pdfBytes as unknown as BlobPart], {
    type: "application/pdf",
  });
  const form = new FormData();
  form.append("file", blob, filename);
  const res = await fetch(UPLOAD_URL, { method: "POST", body: form });
  if (res.status === 413) {
    const body = await res.json().catch(() => null);
    const reason =
      (body as { error?: string } | null)?.error ??
      "File too large (Max 10MB)";
    throw new Error(`FILE_TOO_LARGE_413: ${reason}`);
  }
  if (!res.ok) {
    throw new Error(`UPLOAD_FAILED: filing upload rejected with status ${res.status}`);
  }
  const json = (await res.json().catch(() => null)) as {
    data?: { id?: string };
  } | null;
  const fileId = json?.data?.id;
  if (!fileId) {
    throw new Error("UPLOAD_FAILED: upload returned no Directus file id");
  }
  return fileId;
}

export interface LinkFilingResult {
  recordId: number | null;
  version: number;
}

/**
 * Links a staged upload UUID to the envelope + 201 record (LINK step).
 * @param {number} envelopeId - Locked envelope id.
 * @param {string} fileId - Upload UUID (must exist — never link before UUID).
 * @param {FilingRecordInput} record - 201 record payload.
 * @param {string} reason - Re-file reason (empty for first filing).
 * @returns {Promise<LinkFilingResult>} Created record id + vault version.
 */
export async function linkFiling(
  envelopeId: number,
  fileId: string,
  record: FilingRecordInput,
  reason = ""
): Promise<LinkFilingResult> {
  if (!fileId || fileId.trim() === "") {
    throw new Error("LINK_BEFORE_UUID: cannot link with no upload UUID");
  }
  const res = await fetch(
    `/api/hrm/onboarding/signing-envelopes/${envelopeId}/file`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, record, reason: reason || undefined }),
    }
  );
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    message?: string;
    data?: { recordId?: number | null; version?: number };
  } | null;
  if (!res.ok || !body?.success) {
    throw new Error(body?.message ?? `LINK_FAILED: filing link rejected with status ${res.status}`);
  }
  return {
    recordId: body.data?.recordId ?? null,
    version: body.data?.version ?? 1,
  };
}

/**
 * Files a finished envelope end-to-end (upload → `data.id` → link).
 * @param {FileFinishedEnvelopeInput} input - Filed bytes + 201 record input.
 * @returns {Promise<{ pointer: VaultPointer; staged: StagedFiling }>} Pointer-only vault record.
 */
export async function fileFinishedEnvelope(
  input: FileFinishedEnvelopeInput
): Promise<{ pointer: VaultPointer; staged: StagedFiling }> {
  assertUnderCapOrThrow(input.pdfBytes.byteLength, 1);
  const version = input.version ?? 1;
  const filename = buildFilingFilename(input.envelopeKey, version);
  let staged = stageFiling(
    input.envelopeId,
    filename,
    input.pdfBytes.byteLength,
    version,
    input.reason ?? null
  );
  // Step 1: upload through the existing route.
  const fileId = await uploadFiledPdf(input.pdfBytes, filename);
  // Step 2: persist the returned `data.id` (link reads it from here).
  staged = persistUploadId(staged, fileId);
  // Step 3: link. On failure the server deletes the staged upload
  // (orphan cleanup); the vault marks the staging orphaned and the caller
  // retries from the locked envelope.
  try {
    const linked = await linkFiling(
      input.envelopeId,
      staged.fileId as string,
      input.record,
      input.reason ?? ""
    );
    return { pointer: confirmLink(staged, linked.recordId), staged };
  } catch (error) {
    markOrphaned(staged);
    throw error;
  }
}
