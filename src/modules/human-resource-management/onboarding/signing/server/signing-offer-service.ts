import { z } from "zod";

import {
  JobOfferSchema,
  type JobOffer,
  type Paperworks,
  type SigningEnvelope,
} from "@/modules/human-resource-management/onboarding/signing/types/contracts";
import {
  setApplicantStatus,
  type ApplicantStatus,
} from "@/modules/human-resource-management/shared/services/applicant-status-service";
import { getPhilippineTime, patchRow } from "./signingSetIo";
import { findSigningEnvelopeByApplicant } from "./signingSetRows";
import { readJobOfferById } from "./signingRollupIo";
import { recomputeSigningRollups } from "./signing-rollup-service";

// signing-offer-service.ts — offer acceptance (todo 11). ONE service owns the
// `job_offer.status="signed"` write (+ `signature_file` + PH `signed_at`):
//
//   1. mark the offer signed (idempotent for the same signature file);
//   2. DELEGATE the `signing_envelope.status` recompute to the SINGLE rollup
//      service from todo 12 (`recomputeSigningRollups`) — this module NEVER
//      writes `signing_envelope.status` / `paperworks.status` itself;
//   3. while the envelope is not complete, advance the applicant to
//      `incomplete` through the single status writer (`setApplicantStatus`).
//
// This module MUST NOT create the employee — that is the todo-16 completion
// orchestrator. When the offer signing itself completes the envelope (every
// item was already signed), the todo-15 completion predicate fires INSIDE the
// rollup recompute and the applicant comes back `hired`; setting `incomplete`
// on a fully-signed set would be a lie, so the `incomplete` advance only runs
// while the envelope is still not complete.
//
// The digital-signature hook is future work, so `signature_file` is OPTIONAL
// (null when no file was produced yet) — the offer signature itself is the
// status + timestamp pair.

export const SIGNING_OFFER_ERROR_CODES = {
  invalidInput: "SIGNING_OFFER_INVALID_INPUT",
  offerNotFound: "SIGNING_OFFER_NOT_FOUND",
  offerAlreadySigned: "SIGNING_OFFER_ALREADY_SIGNED",
  offerClosed: "SIGNING_OFFER_CLOSED",
  envelopeNotFound: "SIGNING_OFFER_ENVELOPE_NOT_FOUND",
} as const;

export const SignJobOfferInputSchema = z
  .object({
    offerId: z.number().int().positive(),
    signatureFile: z.string().min(1).nullable(),
  })
  .strict();

export type SignJobOfferInput = z.infer<typeof SignJobOfferInputSchema>;

export interface SignJobOfferResult {
  offer: JobOffer;
  envelope: SigningEnvelope;
  paperworks: Paperworks;
  requiredCount: number;
  signedCount: number;
  /**
   * `"hired"` when the signing set is complete (todo-15 predicate fired in
   * the rollup recompute); `"incomplete"` while the set is still open;
   * `null` when no applicant advance was applicable.
   */
  applicantStatus: ApplicantStatus | null;
}

/**
 * Accept an offer: persist `status="signed"` + `signature_file` +
 * `signed_at`, then run the todo-12 rollup recompute (the ONLY place
 * `signing_envelope.status` is ever written) and advance the applicant to
 * `incomplete` while the signing set is not fully done.
 *
 * Idempotency: re-signing an offer with the SAME signature file is a no-op on
 * the offer and still recomputes/heals the rollups + applicant status
 * (retry-safe); a DIFFERENT signature file on an already-signed offer is
 * refused (a signature is evidence, not a draft).
 * @param rawInput - `{ offerId, signatureFile }` (strict; file may be null).
 * @returns The signed offer plus the post-recompute envelope/batch rows,
 * counts, and the applicant status this call produced (`hired` when the set
 * completed, `incomplete` while it is still open, `null` when no applicant
 * advance was applicable).
 * @throws Error with `SIGNING_OFFER_ERROR_CODES` on invalid input, an absent
 * offer, an attempted overwrite, a declined offer, or a missing envelope; the
 * rollup/status-service coded errors surface unchanged.
 */
export async function signJobOffer(
  rawInput: unknown
): Promise<SignJobOfferResult> {
  const validation = SignJobOfferInputSchema.safeParse(rawInput);
  if (!validation.success) {
    throw new Error(
      `${SIGNING_OFFER_ERROR_CODES.invalidInput}: ${validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  const { offerId, signatureFile } = validation.data;
  const existing = await readJobOfferById(offerId);
  if (!existing) {
    throw new Error(
      `${SIGNING_OFFER_ERROR_CODES.offerNotFound}: job_offer ${offerId} does not exist`
    );
  }

  let offer = existing;
  if (existing.status === "signed") {
    if (existing.signature_file !== signatureFile) {
      throw new Error(
        `${SIGNING_OFFER_ERROR_CODES.offerAlreadySigned}: job_offer ${offerId} is signed with a different signature file`
      );
    }
  } else if (existing.status === "declined") {
    throw new Error(
      `${SIGNING_OFFER_ERROR_CODES.offerClosed}: job_offer ${offerId} is declined and cannot be signed`
    );
  } else {
    const now = getPhilippineTime();
    offer = await patchRow(
      "job_offer",
      offerId,
      {
        status: "signed",
        signature_file: signatureFile,
        signed_at: now,
        updated_at: now,
      },
      JobOfferSchema
    );
  }

  let envelopeId = offer.signing_envelope_id;
  if (envelopeId === null) {
    const envelope = await findSigningEnvelopeByApplicant(offer.applicant_id);
    if (!envelope) {
      throw new Error(
        `${SIGNING_OFFER_ERROR_CODES.envelopeNotFound}: no signing_envelope for job_offer ${offerId} (applicant ${offer.applicant_id})`
      );
    }
    envelopeId = envelope.id;
  }

  const rollup = await recomputeSigningRollups({ envelopeId });

  let applicantStatus: ApplicantStatus | null = rollup.applicantStatus;
  if (rollup.envelope.status !== "complete") {
    const row = await setApplicantStatus({
      applicantId: offer.applicant_id,
      status: "incomplete",
    });
    applicantStatus = row.status;
  }

  return {
    offer,
    envelope: rollup.envelope,
    paperworks: rollup.paperworks,
    requiredCount: rollup.requiredCount,
    signedCount: rollup.signedCount,
    applicantStatus,
  };
}
