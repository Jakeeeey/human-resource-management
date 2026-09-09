// signingVault.ts — Todo 8 vault staging logic (import-safe: no DOM).
//
// Staging rule: the vault keeps the STAGING copy (uploaded Directus file
// UUID) until the 201 link confirms — only then does the vault go
// pointer-only (envelope `pdf_file` UUID + 201 `file_ref` UUID, zero staged
// bytes retained client-side). When the link fails, the staged upload is
// deleted (orphan-file cleanup) so no unlinked file lingers in `201_emp_files`.
//
// Write order (enforced by the filing provider, typed here): upload →
// persist returned `data.id` → link. `file_ref` is NEVER linked before the
// upload UUID exists.
//
// Staging TTL: a staged upload unconfirmed after STAGING_TTL_MS is treated
// as expired — the surface must delete it (orphan cleanup) and re-file from
// the locked envelope. Documented constant, single definition.

/** Staging TTL: 24h — unconfirmed staged uploads expire and must be cleaned. */
export const VAULT_STAGING_TTL_MS = 24 * 60 * 60 * 1000;

/** Directus files folder for filed signing PDFs (existing route's folder). */
export const VAULT_FOLDER = "201_emp_files";

/** Upload ceiling enforced by the existing `?type=employee_file` route. */
export const VAULT_MAX_BYTES = 10 * 1024 * 1024;

export const VAULT_STAGES = ["staged", "linked", "orphaned", "expired"] as const;

export type VaultStage = (typeof VAULT_STAGES)[number];

export interface StagedFiling {
  envelopeId: number;
  /** Directus file UUID — present ONLY after upload returns `data.id`. */
  fileId: string | null;
  fileName: string;
  byteLength: number;
  stage: VaultStage;
  stagedAt: string;
  /** Present on re-file overwrites (new vault version + reason). */
  version: number;
  reason: string | null;
}

export interface VaultPointer {
  envelopeId: number;
  fileId: string;
  recordId: number | null;
  version: number;
}

/**
 * Builds the filed-PDF filename for an envelope (vault versioned).
 * @param {string} envelopeKey - `<profile_id>:<template_id>:<attempt>`.
 * @param {number} version - Vault version (1 = first filing).
 * @returns {string} Deterministic filed filename.
 */
export function buildFilingFilename(envelopeKey: string, version: number): string {
  const safe = envelopeKey.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return version <= 1 ? `signed-${safe}.pdf` : `signed-${safe}-v${version}.pdf`;
}

/**
 * Opens a staging slot for a locked envelope (no UUID yet — link forbidden
 * until the upload returns `data.id`).
 * @param {number} envelopeId - Locked envelope id.
 * @param {string} fileName - Filed-PDF filename.
 * @param {number} byteLength - PDF bytes length.
 * @param {number} version - Vault version (default 1).
 * @param {string | null} reason - Re-file reason (required when version > 1).
 * @returns {StagedFiling} Staging record with `fileId: null`.
 */
export function stageFiling(
  envelopeId: number,
  fileName: string,
  byteLength: number,
  version = 1,
  reason: string | null = null
): StagedFiling {
  if (byteLength > VAULT_MAX_BYTES) {
    throw new Error(
      "FILE_TOO_LARGE_413: staged PDF exceeds the 10MB 201 ceiling — rejected with reason, never silently downscaled"
    );
  }
  if (version > 1 && (!reason || reason.trim() === "")) {
    throw new Error("RE_FILE_NEEDS_REASON: re-file overwrites only with a new vault version + reason");
  }
  return {
    envelopeId,
    fileId: null,
    fileName,
    byteLength,
    stage: "staged",
    stagedAt: new Date().toISOString(),
    version,
    reason,
  };
}

/**
 * Persists the returned upload UUID into the staging record (step 2 of
 * upload → `data.id` → link; link callers must read `fileId` from here).
 * @param {StagedFiling} staged - Open staging record.
 * @param {string} fileId - Directus file UUID from the upload route.
 * @returns {StagedFiling} Staging record carrying the UUID.
 */
export function persistUploadId(staged: StagedFiling, fileId: string): StagedFiling {
  if (!fileId || fileId.trim() === "") {
    throw new Error("LINK_BEFORE_UUID: cannot persist an empty upload id — never link before UUID");
  }
  return { ...staged, fileId };
}

/**
 * Confirms the 201 link: vault drops the staging copy and goes
 * pointer-only (envelope `pdf_file` + 201 `file_ref` UUIDs).
 * @param {StagedFiling} staged - Staging record carrying the upload UUID.
 * @param {number | null} recordId - Created 201 record id.
 * @returns {VaultPointer} Pointer-only vault record.
 */
export function confirmLink(staged: StagedFiling, recordId: number | null): VaultPointer {
  if (!staged.fileId) {
    throw new Error("LINK_BEFORE_UUID: cannot confirm a link with no upload UUID");
  }
  return {
    envelopeId: staged.envelopeId,
    fileId: staged.fileId,
    recordId,
    version: staged.version,
  };
}

/**
 * Marks a staging record orphaned (link failed — staged upload deleted).
 * @param {StagedFiling} staged - Failed staging record.
 * @returns {StagedFiling} Orphaned record.
 */
export function markOrphaned(staged: StagedFiling): StagedFiling {
  return { ...staged, stage: "orphaned" };
}

/**
 * True when a staging record outlived the staging TTL (must be cleaned).
 * @param {StagedFiling} staged - Staging record to inspect.
 * @param {number} nowMs - Current epoch ms (injectable for tests).
 * @returns {boolean} True when expired.
 */
export function isStagingExpired(
  staged: StagedFiling,
  nowMs: number = Date.now()
): boolean {
  const stagedMs = Date.parse(staged.stagedAt);
  if (!Number.isFinite(stagedMs)) return true;
  return nowMs - stagedMs > VAULT_STAGING_TTL_MS;
}
