import type { ManpowerRecommendation } from "../types";
import { isApplicantHired, isApplicantSlotOccupying } from "./applicantPipeline";

// requestStatus.ts — SINGLE SOURCE OF TRUTH for a manpower request's effective
// status.
//
// The open-requests list pill and the request/recommendation detail views all
// render this derivation, so those surfaces can never drift apart. It combines
// the request intent (`no_manpower_needed` + raw request `status`) with the
// APPLICANT pipeline of the request's recommendations — never the recommendation
// artifact `status`, which is a separate lifecycle surfaced as
// "Recommendation status".
//
// Rules (first match wins):
//   - "Closed" — every needed slot is hired.
//   - "Full"   — every needed slot is slot-occupying (final_approved → hired).
//   - "Open"   — an Approved request still has room.
//   - otherwise the raw request status (e.g. "Pending"), or "—" when unknown.

/** Minimal recommendation shape needed to count a request's applicants. */
export type RequestStatusRecommendation = Pick<
    ManpowerRecommendation,
    "manpower_request_id" | "applicant_id" | "status"
>;

export type RequestApplicantCounts = {
    /** Recommendation artifacts still awaiting a decision. */
    recommended: number;
    /** Applicants whose pipeline status commits a slot. */
    approved: number;
    /** Applicants whose pipeline reached hired. */
    hired: number;
};

/**
 * Counts a request's recommendations by pipeline stage.
 * @param recommendations - All loaded recommendations (scoped to the request here).
 * @param requestId - manpower_request_id to count against.
 * @param applicantStatusById - applicant.id -> raw applicant.status (pipeline truth).
 * @returns The recommended / approved / hired counts for the request.
 */
export function countRequestApplicants(
    recommendations: readonly RequestStatusRecommendation[],
    requestId: number,
    applicantStatusById: ReadonlyMap<number, string | null | undefined>,
): RequestApplicantCounts {
    const related = recommendations.filter((r) => r.manpower_request_id === requestId);
    return {
        recommended: related.filter((r) => r.status === "Recommended").length,
        approved: related.filter((r) => isApplicantSlotOccupying(applicantStatusById.get(r.applicant_id))).length,
        hired: related.filter((r) => isApplicantHired(applicantStatusById.get(r.applicant_id))).length,
    };
}

/**
 * Derives the effective status shown by the list pill and the detail views.
 * @param requestStatus - Raw manpower request status (null when the request is unavailable).
 * @param totalSlots - `no_manpower_needed` (0 when unknown/unset).
 * @param counts - Applicant pipeline counts from {@link countRequestApplicants}.
 * @returns "Closed" | "Full" | "Open" | raw request status | "—" when unknown.
 */
export function deriveRequestEffectiveStatus(
    requestStatus: string | null | undefined,
    totalSlots: number,
    counts: Pick<RequestApplicantCounts, "approved" | "hired">,
): string {
    if (totalSlots > 0 && counts.hired >= totalSlots) return "Closed";
    if (totalSlots > 0 && counts.approved >= totalSlots) return "Full";
    if (requestStatus === "Approved") return "Open";
    return requestStatus || "—";
}
