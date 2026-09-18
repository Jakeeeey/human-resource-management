import { z } from "zod";

import {
  getApplicantStatus,
  type ApplicantStatus,
} from "@/modules/human-resource-management/shared/services/applicant-status-service";
import type {
  JobOffer,
  JobOfferStatus,
  PaperworkItem,
  Paperworks,
  SigningEnvelope,
} from "@/modules/human-resource-management/onboarding/signing/types/contracts";
import { SIGNING_SET_ERROR_CODES, getPhilippineTime } from "./signingSetIo";
import {
  findSigningEnvelopeByApplicant,
  insertJobOffer,
  insertPaperworkItemsBatch,
  insertPaperworks,
  insertSigningEnvelope,
  patchJobOfferEnvelopeLink,
  patchPaperworksEnvelopeLink,
  resolveRequiredSigningTemplates,
} from "./signingSetRows";
import {
  advanceFinalApprovedToForSigning,
  echoExistingSet,
  repairExistingSet,
} from "./signingSetAdopt";

// signing-set-service.ts — Final-Approved signing-set creation hook (todo 10).
//
// On the `final_approved` transition this service idempotently materializes
// the applicant-scoped signing set:
//   paperworks (pending, required_count = required template set)
//   -> job_offer (sent, offered_at = PH now)
//   -> signing_envelope (pending, links both)
//   -> one pending paperwork_item per required template
// then advances `applicant.status` through the SINGLE writer
// `setApplicantStatus` (`final_approved` -> `for_signing`).
//
// Idempotency: `signing_envelope.applicant_id` / `paperworks.applicant_id` /
// `job_offer.applicant_id` are UNIQUE. When an envelope already exists the
// call never inserts a second set; it repairs open applicants in place and
// echoes closed ones read-only. NO RE-OFFER: a declined/expired offer closes
// that applicant instance (terminal `rejected`/`withdrawn`) — re-engagement
// starts a NEW applicant, and a terminal applicant is never resurrected.
//
// Required templates: ACTIVE `paperwork_templates`. A supplied `companyId`
// narrows the set through the `paperwork_template_companies` junction; when
// absent (the live applicant/application schema has no company column) the
// locked plan rule applies — every active registry template is required.
//
// EMPTY-SET GUARD: `canSigningSetFireHired` requires `requiredCount >= 1`, so
// a set created against an empty required set can never auto-fire `hired`.

export { SIGNING_SET_ERROR_CODES };
export { resolveRequiredSigningTemplates } from "./signingSetRows";

export const EnsureSigningSetInputSchema = z.object({
  applicantId: z.number().int().positive(),
  companyId: z.number().int().positive().nullable().optional(),
});

export type EnsureSigningSetInput = z.infer<typeof EnsureSigningSetInputSchema>;

export interface SigningSetResult {
  applicantId: number;
  created: boolean;
  envelope: SigningEnvelope;
  jobOffer: JobOffer | null;
  paperworks: Paperworks | null;
  items: PaperworkItem[];
  requiredTemplateIds: number[];
}

const TERMINAL_STATUSES: readonly ApplicantStatus[] = [
  "hired",
  "rejected",
  "withdrawn",
];

const CREATABLE_STATUSES: readonly ApplicantStatus[] = [
  "final_approved",
  "for_signing",
];

/**
 * THE completion predicate guard (todo 10). `hired` may only auto-fire when
 * the offer is signed, every required item is signed, AND the required set is
 * non-empty — an empty set (`requiredCount = 0`) must never complete.
 * @param input - Offer status + required/signed counts of the batch.
 * @returns Whether the set may fire the `hired` transition.
 */
export function canSigningSetFireHired(input: {
  offerStatus: JobOfferStatus;
  requiredCount: number;
  signedCount: number;
}): boolean {
  const hasRequiredTemplates = input.requiredCount >= 1;
  const offerSigned = input.offerStatus === "signed";
  const allItemsSigned = input.signedCount >= input.requiredCount;
  return hasRequiredTemplates && offerSigned && allItemsSigned;
}

/**
 * THE Final-Approved hook. Idempotently materializes the signing set for one
 * applicant and advances `final_approved` -> `for_signing` via the single
 * status writer. Re-runs (resume/retry) adopt the existing envelope and never
 * create a second set; terminal applicants (closed instances) are read-only.
 * @param rawInput - `{ applicantId, companyId? }` (company narrows the
 * required set through the paperwork-template company junction).
 * @returns The (created or adopted) signing set with its required template ids.
 * @throws Error with `SIGNING_SET_ERROR_CODES` on invalid input, unreadable
 * applicant/envelope, a non-creatable applicant state, or a Directus failure.
 */
export async function ensureSigningSetForFinalApproved(
  rawInput: unknown
): Promise<SigningSetResult> {
  const validation = EnsureSigningSetInputSchema.safeParse(rawInput);
  if (!validation.success) {
    throw new Error(
      `${SIGNING_SET_ERROR_CODES.invalidInput}: ${validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  const { applicantId, companyId } = validation.data;
  const status = await getApplicantStatus(applicantId);
  const existing = await findSigningEnvelopeByApplicant(applicantId);

  if (existing) {
    if (TERMINAL_STATUSES.includes(status)) {
      return echoExistingSet(applicantId, existing);
    }
    return repairExistingSet({
      applicantId,
      envelope: existing,
      companyId: companyId ?? null,
      status,
    });
  }

  if (!CREATABLE_STATUSES.includes(status)) {
    throw new Error(
      `${SIGNING_SET_ERROR_CODES.stateNotEligible}: applicant ${applicantId} is '${status}'; a signing set is created only from final_approved/for_signing`
    );
  }

  const now = getPhilippineTime();
  const required = await resolveRequiredSigningTemplates(companyId);
  if (required.length === 0) {
    console.warn(
      `[signing-set] applicant ${applicantId}: required template set is EMPTY` +
        (companyId ? ` for company ${companyId}` : "") +
        " — the set is created but its completion predicate can never fire hired"
    );
  }

  let paperworks = await insertPaperworks({
    applicantId,
    requiredCount: required.length,
    now,
  });
  let jobOffer = await insertJobOffer({ applicantId, now });
  const envelope = await insertSigningEnvelope({
    applicantId,
    jobOfferId: jobOffer.id,
    paperworksId: paperworks.id,
    now,
  });
  paperworks = await patchPaperworksEnvelopeLink({
    paperworksId: paperworks.id,
    envelopeId: envelope.id,
    now,
  });
  jobOffer = await patchJobOfferEnvelopeLink({
    jobOfferId: jobOffer.id,
    envelopeId: envelope.id,
    now,
  });
  const items = await insertPaperworkItemsBatch({
    paperworksId: paperworks.id,
    templateIds: required.map((template) => template.id),
    now,
  });

  await advanceFinalApprovedToForSigning(applicantId, status);
  return {
    applicantId,
    created: true,
    envelope,
    jobOffer,
    paperworks,
    items,
    requiredTemplateIds: required.map((template) => template.id),
  };
}
