import { z } from "zod";

import { getPhilippineTime } from "./signingSetIo";
import {
  findPaperworksByApplicant,
  findSigningEnvelopeByApplicant,
  listPaperworkItems,
} from "./signingSetRows";
import {
  ensureSignedDocsListId,
  insertFiledPdfRecords,
  listExistingFileRefs,
  listFiledRecords,
  listTemplateTitles,
  readApplicantStatus,
} from "./signingFilingIo";

// signing-filing-service.ts — the DEFERRED post-hire filing service (todo 17).
//
// During signing (todo 13) each signed `paperwork_item` carries its flattened
// PDF as a Directus file UUID on `pdf_file`, produced by the EXISTING
// `?type=employee_file` upload path (`uploadFiledPdf` -> `201_emp_files`).
// That is the STAGED state: the bytes exist and the item points at them, but
// no employee record exists because `employee_file_records` requires a
// `user_id` that only exists after the hire.
//
// The todo-16 orchestrator's post-hire step calls this service. It NEVER
// uploads and NEVER invents a second file API: it consumes the staged
// `pdf_file` UUIDs and creates ONE `employee_file_records` row per signed
// item, keyed to the employee (`user_id`) and a shared signed-documents
// intake list (`list_id`). The employee relation stays application-level (a
// `user_id` column + index) — NO DB FK is added between `user` and
// `employee_file_records` (locked plan rule).
//
// IDEMPOTENT: rows already present for (user_id, file_ref) are skipped — a
// soft-deleted record still counts as filed (a re-run never resurrects a
// deliberately deleted document) — and a per-employee in-flight guard
// collapses concurrent runs, so a retried orchestration files ZERO
// duplicates. A read-back verify after the batch insert makes a silent
// partial write impossible.
//
// IO contracts + the intake-list resolve-or-create live in `signingFilingIo.ts`.

export const SIGNED_PDF_FILING_ERROR_CODES = {
  invalidInput: "SIGNED_PDF_FILING_INVALID_INPUT",
  applicantNotHired: "SIGNED_PDF_FILING_APPLICANT_NOT_HIRED",
  itemWithoutFile: "SIGNED_PDF_FILING_ITEM_WITHOUT_FILE",
  fileMissing: "SIGNED_PDF_FILING_FILE_MISSING",
  verifyFailed: "SIGNED_PDF_FILING_VERIFY_FAILED",
} as const;

/** `employee_file_records.record_name` is VARCHAR(150). */
const RECORD_NAME_MAX = 150;

export const FileSignedPaperworkInputSchema = z
  .object({
    applicantId: z.number().int().positive(),
    userId: z.number().int().positive(),
  })
  .strict();

export type FileSignedPaperworkInput = z.infer<
  typeof FileSignedPaperworkInputSchema
>;

export interface FileSignedPaperworkResult {
  applicantId: number;
  userId: number;
  envelopeId: number | null;
  listId: number | null;
  /** Signed `paperwork_item` rows carrying a staged `pdf_file`. */
  signedItems: number;
  /** Records created by THIS run. */
  filed: number;
  /** Staged PDFs already filed before this run (re-run resume). */
  existing: number;
  /** Total records for this employee across the staged PDFs. */
  total: number;
}

function zeroResult(
  applicantId: number,
  userId: number,
  envelopeId: number | null
): FileSignedPaperworkResult {
  return {
    applicantId,
    userId,
    envelopeId,
    listId: null,
    signedItems: 0,
    filed: 0,
    existing: 0,
    total: 0,
  };
}

/** Hard guard against pre-hire filing: only a `hired` applicant is fileable. */
async function assertApplicantHired(applicantId: number): Promise<void> {
  const status = await readApplicantStatus(applicantId);
  if (status !== "hired") {
    throw new Error(
      `${SIGNED_PDF_FILING_ERROR_CODES.applicantNotHired}: applicant ${applicantId} is "${status ?? "absent"}", not "hired" — filing is deferred until the employee exists`
    );
  }
}

function recordNameFor(title: string | undefined, templateId: number): string {
  const base = title?.trim() || `Signed document (template #${templateId})`;
  return base.slice(0, RECORD_NAME_MAX);
}

async function doFileSignedPaperwork(
  applicantId: number,
  userId: number
): Promise<FileSignedPaperworkResult> {
  await assertApplicantHired(applicantId);

  const envelope = await findSigningEnvelopeByApplicant(applicantId);
  if (!envelope) return zeroResult(applicantId, userId, null);

  const paperworksId =
    envelope.paperworks_id ??
    (await findPaperworksByApplicant(applicantId))?.id ??
    null;
  if (paperworksId === null) return zeroResult(applicantId, userId, envelope.id);

  const signedItems = (await listPaperworkItems(paperworksId)).filter(
    (item) => item.status === "signed"
  );
  if (signedItems.length === 0) {
    return zeroResult(applicantId, userId, envelope.id);
  }

  const staged = signedItems.flatMap((item) =>
    item.pdf_file ? [{ item, fileRef: item.pdf_file }] : []
  );
  if (staged.length !== signedItems.length) {
    const missing = signedItems
      .filter((item) => !item.pdf_file)
      .map((item) => item.id);
    throw new Error(
      `${SIGNED_PDF_FILING_ERROR_CODES.itemWithoutFile}: signed paperwork_item(s) ${missing.join(",")} carry no pdf_file — staged PDF missing`
    );
  }
  const fileRefs = staged.map((entry) => entry.fileRef);

  // The staged UUID must still resolve to a Directus file, or the filing
  // would create a record pointing at nothing (misleading success).
  const existingFileIds = new Set(await listExistingFileRefs(fileRefs));
  const absentFiles = fileRefs.filter((ref) => !existingFileIds.has(ref));
  if (absentFiles.length > 0) {
    throw new Error(
      `${SIGNED_PDF_FILING_ERROR_CODES.fileMissing}: staged Directus file(s) not found: ${absentFiles.join(",")}`
    );
  }

  const alreadyFiled = await listFiledRecords(userId, fileRefs);
  const filedRefs = new Set(alreadyFiled.map((record) => record.file_ref));
  const pending = staged.filter((entry) => !filedRefs.has(entry.fileRef));
  if (pending.length === 0) {
    return {
      applicantId,
      userId,
      envelopeId: envelope.id,
      listId: alreadyFiled[0]?.list_id ?? null,
      signedItems: staged.length,
      filed: 0,
      existing: filedRefs.size,
      total: alreadyFiled.length,
    };
  }

  const titleById = await listTemplateTitles([
    ...new Set(pending.map((entry) => entry.item.template_id)),
  ]);
  const listId = await ensureSignedDocsListId();
  const now = getPhilippineTime();
  await insertFiledPdfRecords(
    pending.map((entry) => ({
      userId,
      listId,
      recordName: recordNameFor(
        titleById.get(entry.item.template_id),
        entry.item.template_id
      ),
      description: `Signed onboarding document — applicant #${applicantId}, paperwork item #${entry.item.id}, template #${entry.item.template_id}.`,
      fileRef: entry.fileRef,
      now,
    }))
  );

  const after = await listFiledRecords(userId, fileRefs);
  const afterRefs = new Set(after.map((record) => record.file_ref));
  const unfiled = fileRefs.filter((ref) => !afterRefs.has(ref));
  if (unfiled.length > 0) {
    throw new Error(
      `${SIGNED_PDF_FILING_ERROR_CODES.verifyFailed}: employee_file_records missing after filing: ${unfiled.join(",")}`
    );
  }

  return {
    applicantId,
    userId,
    envelopeId: envelope.id,
    listId,
    signedItems: staged.length,
    filed: pending.length,
    existing: filedRefs.size,
    total: after.length,
  };
}

/** One in-flight run per employee (a retried orchestrator collapses onto it). */
const fileInFlight = new Map<number, Promise<FileSignedPaperworkResult>>();

/**
 * Files every staged signed PDF of one hired applicant to its employee.
 * Call ONLY from the post-hire orchestrator step (a `hired` guard inside
 * refuses every other status, so a pre-hire call can never file).
 * @param rawInput - `{ applicantId, userId }` (strict).
 * @returns Counts + the resolved intake `listId` (`null` when nothing is
 * staged yet).
 * @throws Error with `SIGNED_PDF_FILING_ERROR_CODES` on invalid input, a
 * non-hired applicant, a signed item without a staged PDF, a staged UUID
 * whose file no longer exists, or a write that is not visible on read-back.
 */
export function fileSignedPaperwork(
  rawInput: unknown
): Promise<FileSignedPaperworkResult> {
  const validation = FileSignedPaperworkInputSchema.safeParse(rawInput);
  if (!validation.success) {
    return Promise.reject(
      new Error(
        `${SIGNED_PDF_FILING_ERROR_CODES.invalidInput}: ${validation.error.issues
          .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
          .join("; ")}`
      )
    );
  }
  const { applicantId, userId } = validation.data;

  const current = fileInFlight.get(userId);
  if (current) return current;

  const task = doFileSignedPaperwork(applicantId, userId).finally(() => {
    fileInFlight.delete(userId);
  });
  fileInFlight.set(userId, task);
  return task;
}
