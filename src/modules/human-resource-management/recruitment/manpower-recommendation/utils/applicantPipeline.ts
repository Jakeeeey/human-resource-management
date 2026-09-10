import type { ApplicantStatus } from "@/modules/human-resource-management/onboarding/types/applicant-status";

// applicantPipeline.ts — the manpower-recommendation module's read model of the
// APPLICANT pipeline (todo 8 reconciliation).
//
// `manpower_recommendation.status` is the recruitment ARTIFACT lifecycle
// (Recommended -> Approved/Hired/Rejected/Withdrawn) and stays intact; it is
// never the pipeline. The pipeline truth is `applicant.status` (single writer:
// shared/services/applicant-status-service). Slot occupancy, hire counts and
// approval guards therefore read the APPLICANT status: a slot is committed once
// the applicant reached `final_approved` and stays committed through signing
// (`for_signing`, `incomplete`) until `hired`. A `rejected`/`withdrawn`
// applicant never occupies a slot — even when a stale rec row still reads
// Approved/Hired.

/** Applicant statuses that commit a manpower slot (approved -> signing -> hired). */
export const SLOT_OCCUPYING_APPLICANT_STATUSES = [
  "final_approved",
  "for_signing",
  "incomplete",
  "hired",
] as const satisfies readonly ApplicantStatus[];

/**
 * True when the applicant pipeline commits a manpower slot.
 * @param status - Raw `applicant.status` (or null/undefined when unknown).
 * @returns Whether the applicant occupies a slot.
 */
export function isApplicantSlotOccupying(status: string | null | undefined): boolean {
  return (SLOT_OCCUPYING_APPLICANT_STATUSES as readonly string[]).includes(status ?? "");
}

/**
 * True when the applicant pipeline finished hiring.
 * @param status - Raw `applicant.status` (or null/undefined when unknown).
 * @returns Whether the applicant is hired.
 */
export function isApplicantHired(status: string | null | undefined): boolean {
  return status === "hired";
}
