import { z } from "zod";

import {
  getApplicantStatus,
  setApplicantStatus,
  type ApplicantStatus,
} from "@/modules/human-resource-management/shared/services/applicant-status-service";
import {
  JobOfferSchema,
  type JobOffer,
} from "@/modules/human-resource-management/onboarding/signing/types/contracts";
import { getPhilippineTime, patchRow } from "./signingSetIo";
import { readJobOfferById } from "./signingRollupIo";

// signing-closeout-service.ts — terminal close-out for NON-SIGNING applicants
// (todo 18). The locked mapping:
//
//   applicant declines the offer -> applicant `withdrawn` + offer `declined`
//   HR rejects / withdraws       -> applicant `rejected`  + offer `declined`
//   offer expires                -> applicant `rejected`  + offer `declined`
//                                   (`expired` is NOT a stored job_offer value;
//                                   expiry batches into `declined`)
//
// THE ONLY WRITES:
//   - `applicant.status` goes exclusively through the single status writer
//     `setApplicantStatus` (todo 2) — this service never PATCHes applicant;
//   - `job_offer.status` goes through the todo-9/11 offer route family using
//     the same `patchRow` IO `signJobOffer` (todo 11) owns. This is the only
//     other module allowed to move an offer to `declined`.
//
// NO EMPLOYEE: nothing here imports or calls the todo-16 hire orchestrator —
// a close-out never creates or touches a Spring user.
// NO RE-OFFER: the signing set is left byte-for-byte intact (no deletes, no
// status resets). Re-engagement always starts a NEW applicant; the todo-10
// hook already treats terminal applicants as read-only echoes.
// NO TIMER: expiry is an explicit action on one offer, never a background
// sweep, so an open signing set can never auto-close.
//
// TERMINAL GUARD: a `hired` applicant is refused BEFORE any write — a
// completed hire cannot be closed out. The single writer would also refuse
// `hired -> rejected/withdrawn`, but the explicit pre-check guarantees the
// offer status is never flipped on a refused close-out.

export const CLOSE_OUT_OUTCOMES = [
  "applicant_declined",
  "hr_rejected",
  "offer_expired",
] as const;

export type CloseOutOutcome = (typeof CLOSE_OUT_OUTCOMES)[number];

export const CloseOutOutcomeSchema = z.enum(CLOSE_OUT_OUTCOMES);

// The three outcomes collapse onto two applicant terminals: declining is the
// applicant's own act (`withdrawn`); an HR rejection AND an expiry are HR-side
// closures (`rejected`).
const CLOSE_OUT_APPLICANT_STATUS: Record<CloseOutOutcome, ApplicantStatus> = {
  applicant_declined: "withdrawn",
  hr_rejected: "rejected",
  offer_expired: "rejected",
};

/** Error codes thrown by this service — callers branch on the prefix. */
export const SIGNING_CLOSEOUT_ERROR_CODES = {
  invalidInput: "SIGNING_CLOSEOUT_INVALID_INPUT",
  offerNotFound: "SIGNING_CLOSEOUT_OFFER_NOT_FOUND",
  applicantHired: "SIGNING_CLOSEOUT_APPLICANT_HIRED",
} as const;

export const CloseOutNonSignerInputSchema = z
  .object({
    offerId: z.number().int().positive(),
    outcome: CloseOutOutcomeSchema,
  })
  .strict();

export type CloseOutNonSignerInput = z.infer<
  typeof CloseOutNonSignerInputSchema
>;

export interface CloseOutNonSignerResult {
  applicantId: number;
  outcome: CloseOutOutcome;
  applicantStatus: ApplicantStatus;
  offer: JobOffer;
}

/**
 * Closes out one non-signing applicant: applies the locked outcome mapping to
 * `applicant.status` (via the single writer) and `job_offer.status` (declined),
 * leaving the signing set untouched and creating no employee.
 * @param rawInput - `{ offerId, outcome }` where outcome is
 * `applicant_declined` | `hr_rejected` | `offer_expired` (strict).
 * @returns The closed applicant id + resulting status and the declined offer.
 * @throws Error with `SIGNING_CLOSEOUT_ERROR_CODES` on invalid input, an absent
 * offer, or a `hired` (terminal) applicant; the status writer's coded errors
 * surface unchanged for any other illegal transition.
 */
export async function closeOutNonSigner(
  rawInput: unknown
): Promise<CloseOutNonSignerResult> {
  const validation = CloseOutNonSignerInputSchema.safeParse(rawInput);
  if (!validation.success) {
    throw new Error(
      `${SIGNING_CLOSEOUT_ERROR_CODES.invalidInput}: ${validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  const { offerId, outcome } = validation.data;

  const existing = await readJobOfferById(offerId);
  if (!existing) {
    throw new Error(
      `${SIGNING_CLOSEOUT_ERROR_CODES.offerNotFound}: job_offer ${offerId} does not exist`
    );
  }

  // Terminal guard BEFORE any write: a completed hire must never be closed
  // out, and the offer status must not flip while the applicant is refused.
  const currentStatus = await getApplicantStatus(existing.applicant_id);
  if (currentStatus === "hired") {
    throw new Error(
      `${SIGNING_CLOSEOUT_ERROR_CODES.applicantHired}: applicant ${existing.applicant_id} is hired (terminal) and cannot be closed out`
    );
  }

  // Applicant first, offer second: if the offer write ever failed, a retry is
  // a same-status no-op on the applicant and heals the offer — the reverse
  // order could leave a declined offer attached to an open applicant.
  const applicant = await setApplicantStatus({
    applicantId: existing.applicant_id,
    status: CLOSE_OUT_APPLICANT_STATUS[outcome],
  });

  // Idempotent: an offer already `declined` (retry / partial previous run) is
  // re-observed, never re-written.
  let offer = existing;
  if (existing.status !== "declined") {
    offer = await patchRow(
      "job_offer",
      offerId,
      { status: "declined", updated_at: getPhilippineTime() },
      JobOfferSchema
    );
  }

  return {
    applicantId: existing.applicant_id,
    outcome,
    applicantStatus: applicant.status,
    offer,
  };
}
