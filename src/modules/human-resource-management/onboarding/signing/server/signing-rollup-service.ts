import { z } from "zod";

import {
  type JobOffer,
  type PaperworkItem,
  type Paperworks,
  type SigningEnvelope,
} from "@/modules/human-resource-management/onboarding/signing/types/contracts";
import type { ApplicantStatus } from "@/modules/human-resource-management/shared/services/applicant-status-service";
import { fireHiredIfComplete } from "./signingHireCommit";
import { getPhilippineTime } from "./signingSetIo";
import {
  findSigningEnvelopeByApplicant,
  listPaperworkItems,
} from "./signingSetRows";
import { deriveSigningRollups } from "./signingRollupRule";
import {
  readJobOfferById,
  readPaperworkItemById,
  readPaperworksById,
  readSigningEnvelopeById,
  writePaperworkItemSignature,
  writePaperworksRollup,
  writeSigningEnvelopeStatus,
} from "./signingRollupIo";

// signing-rollup-service.ts — THE per-item signing + derived-rollup service
// (todo 12). This module is the SINGLE place that recomputes
// `paperworks.status` and `signing_envelope.status`; no other module may
// write either column as a rollup. Todo 11 (offer signing) delegates the
// envelope recompute here:
//
//   import { recomputeSigningRollups } from
//     "@/modules/human-resource-management/onboarding/signing/server/signing-rollup-service";
//   await recomputeSigningRollups({ envelopeId: offer.signing_envelope_id });
//
// Todo 15/16 extend the SAME path: after the rollup writes,
// `fireHiredIfComplete` (signingHireCommit.ts) applies the todo-10 predicate,
// fires the ONE `hired` transition via `setApplicantStatus`, and immediately
// runs the todo-16 employee-creation orchestrator for the same applicant.
//
// Rollup rules (locked plan contract):
// - `paperworks.status`: pending = 0 signed; partial = some signed; complete
//   = all required signed, i.e. `signed_count >= required_count`.
// - EMPTY-SET GUARD: `required_count = 0` never rolls up to complete
//   (mirrors `canSigningSetFireHired` — an empty required set cannot finish).
// - `signing_envelope.status`: complete iff `job_offer.status = 'signed'`
//   AND every `paperwork_item` is signed (and the required set is non-empty);
//   otherwise pending.
//
// `signed_count` is recomputed from the actual item rows on every call, so a
// retry heals a half-written rollup; a call that changes nothing performs NO
// write (idempotent resume). The item mutation itself is idempotent only for
// the same evidence — an already-signed item can never be overwritten with a
// different signature.

export const SIGNING_ROLLUP_ERROR_CODES = {
  invalidInput: "SIGNING_ROLLUP_INVALID_INPUT",
  readFailed: "SIGNING_ROLLUP_READ_FAILED",
  itemNotFound: "SIGNING_ROLLUP_ITEM_NOT_FOUND",
  itemAlreadySigned: "SIGNING_ROLLUP_ITEM_ALREADY_SIGNED",
  envelopeNotFound: "SIGNING_ROLLUP_ENVELOPE_NOT_FOUND",
  envelopeStructureInvalid: "SIGNING_ROLLUP_ENVELOPE_STRUCTURE_INVALID",
} as const;

export const SignPaperworkItemInputSchema = z
  .object({
    itemId: z.number().int().positive(),
    strokes: z.string().min(1),
    pdfFile: z.string().min(1),
  })
  .strict();

export type SignPaperworkItemInput = z.infer<
  typeof SignPaperworkItemInputSchema
>;

export const RecomputeSigningRollupsInputSchema = z
  .object({
    envelopeId: z.number().int().positive(),
  })
  .strict();

export type RecomputeSigningRollupsInput = z.infer<
  typeof RecomputeSigningRollupsInputSchema
>;

export interface SigningRollupResult {
  envelope: SigningEnvelope;
  paperworks: Paperworks;
  jobOffer: JobOffer;
  items: PaperworkItem[];
  requiredCount: number;
  signedCount: number;
  /** `"hired"` when this call fired/re-observed the completion; else null. */
  applicantStatus: ApplicantStatus | null;
}

export interface SignPaperworkItemResult {
  item: PaperworkItem;
  envelope: SigningEnvelope;
  paperworks: Paperworks;
  requiredCount: number;
  signedCount: number;
  /** `"hired"` when THIS signature completed the set; else null. */
  applicantStatus: ApplicantStatus | null;
}

/**
 * Sign ONE required paperwork item: persist `status="signed"` + `strokes` +
 * `pdf_file` (+ PH `signed_at`), then recompute both derived rollups through
 * the one service. A retry with the SAME evidence is a no-op on the item and
 * still recomputes (heals a rollup write that failed after the item write); a
 * retry with DIFFERENT evidence is refused.
 * @param rawInput - `{ itemId, strokes, pdfFile }` (strict).
 * @returns The signed item, the post-recompute rows, and the applicant
 * status this signature produced (`"hired"` when it completed the set).
 * @throws Error with `SIGNING_ROLLUP_ERROR_CODES` on invalid input, an absent
 * item, an attempted overwrite, a missing envelope, or a Directus failure.
 */
export async function signPaperworkItem(
  rawInput: unknown
): Promise<SignPaperworkItemResult> {
  const validation = SignPaperworkItemInputSchema.safeParse(rawInput);
  if (!validation.success) {
    throw new Error(
      `${SIGNING_ROLLUP_ERROR_CODES.invalidInput}: ${validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  const { itemId, strokes, pdfFile } = validation.data;
  const existing = await readPaperworkItemById(itemId);
  if (!existing) {
    throw new Error(
      `${SIGNING_ROLLUP_ERROR_CODES.itemNotFound}: paperwork_item ${itemId} does not exist`
    );
  }

  let item = existing;
  if (existing.status === "signed") {
    if (existing.strokes !== strokes || existing.pdf_file !== pdfFile) {
      throw new Error(
        `${SIGNING_ROLLUP_ERROR_CODES.itemAlreadySigned}: paperwork_item ${itemId} is signed with different evidence`
      );
    }
  } else {
    item = await writePaperworkItemSignature({
      itemId,
      strokes,
      pdfFile,
      now: getPhilippineTime(),
    });
  }

  const paperworks = await readPaperworksById(item.paperworks_id);
  if (!paperworks) {
    throw new Error(
      `${SIGNING_ROLLUP_ERROR_CODES.readFailed}: paperworks ${item.paperworks_id} for item ${itemId} is not readable`
    );
  }
  const envelope =
    paperworks.signing_envelope_id !== null
      ? await readSigningEnvelopeById(paperworks.signing_envelope_id)
      : await findSigningEnvelopeByApplicant(paperworks.applicant_id);
  if (!envelope) {
    throw new Error(
      `${SIGNING_ROLLUP_ERROR_CODES.envelopeNotFound}: no signing_envelope for item ${itemId} (paperworks ${paperworks.id})`
    );
  }

  const rollup = await recomputeSigningRollups({
    envelopeId: envelope.id,
  });
  return {
    item,
    envelope: rollup.envelope,
    paperworks: rollup.paperworks,
    requiredCount: rollup.requiredCount,
    signedCount: rollup.signedCount,
    applicantStatus: rollup.applicantStatus,
  };
}

/**
 * THE single rollup recompute (todo 11 delegates here after writing the
 * offer). Re-reads the batch items + offer from Directus, derives both
 * statuses, and writes ONLY the columns that changed:
 *   - `paperworks.signed_count` + `paperworks.status` in one PATCH;
 *   - `signing_envelope.status` in one PATCH.
 * Todo 15 completion: when the recomputed state satisfies
 * `canSigningSetFireHired`, the applicant advances to `hired` via the single
 * status writer (partial/empty sets never fire).
 * @param rawInput - `{ envelopeId }` (strict).
 * @returns The post-recompute envelope, batch, offer, items, counts, and the
 * `hired` status this call fired/observed (`null` while incomplete).
 * @throws Error with `SIGNING_ROLLUP_ERROR_CODES` when the envelope is absent
 * or its offer/batch links are missing, or a Directus read/write fails; the
 * status service error codes surface unchanged when `hired` is disallowed.
 */
export async function recomputeSigningRollups(
  rawInput: unknown
): Promise<SigningRollupResult> {
  const validation = RecomputeSigningRollupsInputSchema.safeParse(rawInput);
  if (!validation.success) {
    throw new Error(
      `${SIGNING_ROLLUP_ERROR_CODES.invalidInput}: ${validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  const { envelopeId } = validation.data;
  const envelope = await readSigningEnvelopeById(envelopeId);
  if (!envelope) {
    throw new Error(
      `${SIGNING_ROLLUP_ERROR_CODES.envelopeNotFound}: signing_envelope ${envelopeId} does not exist`
    );
  }
  const { paperworks_id: paperworksId, joboffer_id: jobOfferId } = envelope;
  if (paperworksId === null || jobOfferId === null) {
    throw new Error(
      `${SIGNING_ROLLUP_ERROR_CODES.envelopeStructureInvalid}: signing_envelope ${envelopeId} is missing its paperworks/offer link`
    );
  }

  const [paperworks, items, jobOffer] = await Promise.all([
    readPaperworksById(paperworksId),
    listPaperworkItems(paperworksId),
    readJobOfferById(jobOfferId),
  ]);
  if (!paperworks) {
    throw new Error(
      `${SIGNING_ROLLUP_ERROR_CODES.readFailed}: paperworks ${paperworksId} of envelope ${envelopeId} is not readable`
    );
  }
  if (!jobOffer) {
    throw new Error(
      `${SIGNING_ROLLUP_ERROR_CODES.readFailed}: job_offer ${jobOfferId} of envelope ${envelopeId} is not readable`
    );
  }

  const { signedCount, paperworksStatus, envelopeStatus } =
    deriveSigningRollups({
      requiredCount: paperworks.required_count,
      itemStatuses: items.map((entry) => entry.status),
      offerStatus: jobOffer.status,
    });
  const now = getPhilippineTime();

  let updatedPaperworks = paperworks;
  if (
    paperworks.signed_count !== signedCount ||
    paperworks.status !== paperworksStatus
  ) {
    updatedPaperworks = await writePaperworksRollup({
      paperworksId,
      status: paperworksStatus,
      signedCount,
      now,
    });
  }

  let updatedEnvelope = envelope;
  if (envelope.status !== envelopeStatus) {
    updatedEnvelope = await writeSigningEnvelopeStatus({
      envelopeId,
      status: envelopeStatus,
      now,
    });
  }

  const applicantStatus = await fireHiredIfComplete({
    applicantId: envelope.applicant_id,
    offerStatus: jobOffer.status,
    requiredCount: paperworks.required_count,
    signedCount,
  });

  return {
    envelope: updatedEnvelope,
    paperworks: updatedPaperworks,
    jobOffer,
    items,
    requiredCount: paperworks.required_count,
    signedCount,
    applicantStatus,
  };
}
