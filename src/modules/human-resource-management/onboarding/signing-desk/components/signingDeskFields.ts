import type { JobOffer } from "../../signing/types/contracts";

// signingDeskFields.ts — shared Department/Position derivation for the signing
// desk (used by both the lg+ table and the <lg cards so the two surfaces never
// diverge). It reads ONLY data the desk already holds on the row:
//
//   position    — the applicant's `position_applied_for` (canonical pipeline
//                 field), falling back to the offer letter's `position`.
//   department  — the department NAME captured on the offer letter snapshot
//                 (`job_offer.terms_snapshot`, the `JobOfferFormData` blob the
//                 recruitment Job Offer module writes). It is already a name —
//                 no id lookup and no extra fetch.
//
// Nothing is fabricated: a missing value comes back as `null` and the surfaces
// render a placeholder. Raw DB status strings are never surfaced.

export interface SigningDeskJobFields {
  department: string | null;
  position: string | null;
}

function readSnapshotString(
  snapshot: JobOffer["terms_snapshot"],
  key: "department" | "position"
): string | null {
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) {
    return null;
  }
  const value = (snapshot as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function signingDeskJobFields(
  positionAppliedFor: string | null,
  offer: JobOffer | null
): SigningDeskJobFields {
  const snapshot = offer?.terms_snapshot ?? null;
  const applicantPosition =
    typeof positionAppliedFor === "string" && positionAppliedFor.trim()
      ? positionAppliedFor.trim()
      : null;
  return {
    position: applicantPosition ?? readSnapshotString(snapshot, "position"),
    department: readSnapshotString(snapshot, "department"),
  };
}
