import type { Interview } from "../types";

/**
 * Smart stage derivation for the schedule step (single helper, reused by the
 * schedule dialog and the POST schedule-only path — both must agree).
 *
 * Rules: the applicant's latest Initial verdict of Passed promotes the next
 * interview to Final; no Initial yet, a Failed Initial, or an ungraded
 * (Pending/sheet-less) Initial keeps the next interview at Initial. An
 * application that already carries a Passed Final is done — null is returned
 * so the caller EXCLUDES it from the applicant select entirely.
 * @param applicationId - Quiz-completed application id being scheduled.
 * @param interviews - All interview rows, latest-first (server sort).
 * @returns "Initial" | "Final", or null when a Passed Final already exists.
 */
export function deriveScheduleStage(
    applicationId: number,
    interviews: Pick<Interview, "application_id" | "stage" | "verdict">[],
): "Initial" | "Final" | null {
    const hasPassedFinal = interviews.some(
        (interview) =>
            interview.stage === "Final" &&
            interview.application_id === applicationId &&
            interview.verdict === "Passed",
    );
    if (hasPassedFinal) return null;
    const latestInitial = interviews.find(
        (interview) => interview.stage === "Initial" && interview.application_id === applicationId,
    );
    if (latestInitial?.verdict === "Passed") return "Final";
    return "Initial";
}

/**
 * Dedupe lookup for the schedule step: an ungraded (sheet-less) interview
 * already exists for the derived application + stage, so the caller must NOT
 * create a duplicate — it routes to that row's grade page instead.
 * @param applicationId - Application id being scheduled.
 * @param stage - Derived stage from deriveScheduleStage.
 * @param interviews - All interview rows.
 * @returns The ungraded interview row, or null when scheduling is fresh.
 */
export function findUngradedInterview<T extends Pick<Interview, "application_id" | "stage" | "score_sheet_id">>(
    applicationId: number,
    stage: "Initial" | "Final",
    interviews: T[],
): T | null {
    return (
        interviews.find(
            (interview) =>
                interview.application_id === applicationId &&
                interview.stage === stage &&
                interview.score_sheet_id == null,
        ) ?? null
    );
}
