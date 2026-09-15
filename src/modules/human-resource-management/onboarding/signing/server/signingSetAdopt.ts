import {
  setApplicantStatus,
  type ApplicantStatus,
} from "@/modules/human-resource-management/shared/services/applicant-status-service";
import type { SigningEnvelope } from "@/modules/human-resource-management/onboarding/signing/types/contracts";
import { getPhilippineTime } from "./signingSetIo";
import {
  findJobOfferByApplicant,
  findPaperworksByApplicant,
  insertJobOffer,
  insertPaperworkItemsBatch,
  insertPaperworks,
  listPaperworkItems,
  patchJobOfferEnvelopeLink,
  patchPaperworksEnvelopeLink,
  patchPaperworksRequiredCount,
  patchSigningEnvelopeLinks,
  resolveRequiredSigningTemplates,
} from "./signingSetRows";
import type { SigningSetResult } from "./signing-set-service";

// signingSetAdopt.ts — the re-run (adopt/repair) paths of the signing-set
// creation hook (todo 10). When an envelope already exists the hook must never
// insert a second set: OPEN applicants get missing structural pieces + links
// repaired in place, TERMINAL applicants (closed instances: hired/rejected/
// withdrawn) are echoed read-only and never resurrected or mutated.

/**
 * Advance only the untransitioned approval state; every other status is left
 * untouched (`for_signing`+ means the set is already live, terminal means the
 * instance is closed). The single status writer stays the only `applicant`
 * PATCH.
 */
export async function advanceFinalApprovedToForSigning(
  applicantId: number,
  status: ApplicantStatus
): Promise<void> {
  if (status === "final_approved") {
    await setApplicantStatus({ applicantId, status: "for_signing" });
  }
}

/** Read-only echo of an existing set — no writes, for closed applicants. */
export async function echoExistingSet(
  applicantId: number,
  envelope: SigningEnvelope
): Promise<SigningSetResult> {
  const [paperworks, jobOffer] = await Promise.all([
    findPaperworksByApplicant(applicantId),
    findJobOfferByApplicant(applicantId),
  ]);
  const items = paperworks ? await listPaperworkItems(paperworks.id) : [];
  return {
    applicantId,
    created: false,
    envelope,
    jobOffer,
    paperworks,
    items,
    requiredTemplateIds: items.map((item) => item.template_id),
  };
}

/**
 * Adopt/repair the existing set for an open applicant: recreate a missing
 * batch/offer, relink the aggregate both ways, and fill items only when the
 * batch never materialized them (empty item table + zero signed). A non-empty
 * item table is the source of truth — it is never re-derived from a possibly
 * different company context on re-run.
 */
export async function repairExistingSet(input: {
  applicantId: number;
  envelope: SigningEnvelope;
  companyId: number | null;
  status: ApplicantStatus;
}): Promise<SigningSetResult> {
  const { applicantId, companyId, status } = input;
  const now = getPhilippineTime();
  let { envelope } = input;
  let paperworks = await findPaperworksByApplicant(applicantId);
  let jobOffer = await findJobOfferByApplicant(applicantId);

  if (!paperworks) {
    const required = await resolveRequiredSigningTemplates(companyId);
    paperworks = await insertPaperworks({
      applicantId,
      requiredCount: required.length,
      now,
    });
  }
  if (!jobOffer) {
    jobOffer = await insertJobOffer({ applicantId, now });
  }
  if (paperworks.signing_envelope_id !== envelope.id) {
    paperworks = await patchPaperworksEnvelopeLink({
      paperworksId: paperworks.id,
      envelopeId: envelope.id,
      now,
    });
  }
  if (jobOffer.signing_envelope_id !== envelope.id) {
    jobOffer = await patchJobOfferEnvelopeLink({
      jobOfferId: jobOffer.id,
      envelopeId: envelope.id,
      now,
    });
  }
  if (
    envelope.joboffer_id !== jobOffer.id ||
    envelope.paperworks_id !== paperworks.id
  ) {
    envelope = await patchSigningEnvelopeLinks({
      envelopeId: envelope.id,
      jobOfferId: jobOffer.id,
      paperworksId: paperworks.id,
      now,
    });
  }

  let items = await listPaperworkItems(paperworks.id);
  if (items.length === 0 && paperworks.signed_count === 0) {
    const required = await resolveRequiredSigningTemplates(companyId);
    if (required.length > 0) {
      items = await insertPaperworkItemsBatch({
        paperworksId: paperworks.id,
        templateIds: required.map((template) => template.id),
        now,
      });
      if (paperworks.required_count !== required.length) {
        paperworks = await patchPaperworksRequiredCount({
          paperworksId: paperworks.id,
          requiredCount: required.length,
          now,
        });
      }
    }
  }

  await advanceFinalApprovedToForSigning(applicantId, status);
  return {
    applicantId,
    created: false,
    envelope,
    jobOffer,
    paperworks,
    items,
    requiredTemplateIds: items.map((item) => item.template_id),
  };
}
