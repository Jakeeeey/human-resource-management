/**
 * Pure derivation helper for the Applicants overview module.
 *
 * Maps joined pipeline rows (application + Initial interviews +
 * recommendations + Final interviews) to `{ stage, timeline }`.
 *
 * Quiz is advisory-only (never a hard gate), so quiz results do not occupy
 * stages: every registered applicant has an application and a quiz attempt,
 * and derivation starts at the Initial-interview signal. Applicants with no
 * Initial row yet (awaiting scheduling/grading) map to "Initial Pending".
 *
 * Ported (never imported) rec-scoped rules from
 * `recruitment/interviews/hooks/useInterview.ts` (lines 74-106):
 * - `latestPerApplication`: the latest interview wins (`created_at` desc,
 *   `id` desc tiebreak).
 * - `hasGradedFinal`: a recommendation leaves the pending set only when a
 *   Final interview with a graded (Passed/Failed) verdict exists for that
 *   `recommendation_id`.
 * - `pendingFinals`: a Pending Final keeps its recommendation
 *   eligible-display (it is awaiting the explicit verdict step).
 *
 * Precedence table: furthest lifecycle progress wins (rank = index in
 * {@link APPLICANT_STAGE}); terminal recommendation statuses
 * (Approved/Hired/Rejected/Withdrawn) outrank earlier signals; same-rank
 * ties resolve latest-wins (`created_at` desc, `id` desc); no
 * Initial/recommendation/Final signal yet yields "Initial Pending".
 *
 * Hook-free and dependency-free: plain JSON-serializable input, no `Date`
 * instances, no framework imports — safe to call from a server route.
 */

/** Ordered applicant pipeline stages. Index = precedence rank. */
export const APPLICANT_STAGE = [
    "Initial Pending",
    "Initial Passed",
    "Initial Failed",
    "Recommended",
    "Final Pending",
    "Approved",
    "Hired",
    "Rejected",
    "Withdrawn",
] as const;

export type ApplicantStage = (typeof APPLICANT_STAGE)[number];

export type InterviewVerdict = "Pending" | "Passed" | "Failed";

export type RecommendationStatus =
    | "Recommended"
    | "Approved"
    | "Hired"
    | "Rejected"
    | "Withdrawn";

export type StageApplicationInput = {
    id: number;
    submitted_at: string | null;
    /** Snapshot of the latest quiz outcome carried on the application row. */
    quiz_passed: boolean | null;
};

export type StageQuizAttemptInput = {
    id: number;
    passed: boolean | null;
    created_at: string | null;
};

export type StageInterviewInput = {
    id: number;
    /** Final interviews scope to a recommendation; Initials scope to the application. */
    recommendation_id: number | null;
    verdict: InterviewVerdict;
    created_at: string | null;
};

export type StageRecommendationInput = {
    id: number;
    status: RecommendationStatus;
    created_at: string | null;
};

/**
 * Joined pipeline input for one applicant. All fields are JSON-serializable;
 * date fields are ISO strings (or null when unknown — treated as oldest).
 */
export type DeriveApplicantStageInput = {
    application: StageApplicationInput | null;
    /**
     * Latest quiz attempt; retained for input-shape stability. Quiz is
     * advisory-only and no longer drives stage derivation.
     */
    quizAttempt: StageQuizAttemptInput | null;
    initialInterviews: StageInterviewInput[];
    recommendations: StageRecommendationInput[];
    finalInterviews: StageInterviewInput[];
};

export type StageTimelineEvent = {
    stage: ApplicantStage;
    /** ISO timestamp of the event, or null when unknown. */
    at: string | null;
    detail: string;
};

export type DeriveApplicantStageResult = {
    stage: ApplicantStage;
    /** All observed signals, oldest-first. */
    timeline: StageTimelineEvent[];
};

type Signal = {
    stage: ApplicantStage;
    at: string | null;
    id: number;
    detail: string;
};

function rankOf(stage: ApplicantStage): number {
    return APPLICANT_STAGE.indexOf(stage);
}

/**
 * Recency order: later `created_at` wins; null/empty counts as oldest;
 * `id` desc breaks ties (mirrors the API `sort=-created_at` + id order).
 * @returns Positive when `a` is more recent than `b`.
 */
function compareRecency(
    a: { at: string | null; id: number },
    b: { at: string | null; id: number },
): number {
    const aAt = a.at ?? "";
    const bAt = b.at ?? "";
    if (aAt !== bAt) return aAt > bAt ? 1 : -1;
    return a.id - b.id;
}

/** Latest row wins (ported `latestPerApplication` rule). */
function latestBy<T extends { at: string | null; id: number }>(
    rows: T[],
): T | null {
    let best: T | null = null;
    for (const row of rows) {
        if (best === null || compareRecency(row, best) > 0) best = row;
    }
    return best;
}

function initialStageFor(verdict: InterviewVerdict): ApplicantStage {
    if (verdict === "Passed") return "Initial Passed";
    if (verdict === "Failed") return "Initial Failed";
    return "Initial Pending";
}

function finalStageFor(verdict: InterviewVerdict): ApplicantStage {
    // Graded Finals collapse into the recommendation outcome they drive
    // (Passed auto-approves, Failed auto-rejects): no separate stages.
    if (verdict === "Passed") return "Approved";
    if (verdict === "Failed") return "Rejected";
    return "Final Pending";
}

/**
 * Derive the applicant stage and timeline from joined pipeline rows.
 * @param input - Joined rows for one applicant (see {@link DeriveApplicantStageInput}).
 * @returns The winning `stage` plus the oldest-first `timeline` of signals.
 */
export function deriveApplicantStage(
    input: DeriveApplicantStageInput,
): DeriveApplicantStageResult {
    const signals: Signal[] = [];

    const latestInitial = latestBy(
        input.initialInterviews.map((row) => ({
            at: row.created_at,
            id: row.id,
            verdict: row.verdict,
        })),
    );
    if (latestInitial !== null) {
        signals.push({
            stage: initialStageFor(latestInitial.verdict),
            at: latestInitial.at,
            id: latestInitial.id,
            detail: `Initial interview #${latestInitial.id}: ${latestInitial.verdict}`,
        });
    }

    const latestRecommendation = latestBy(
        input.recommendations.map((row) => ({
            at: row.created_at,
            id: row.id,
            status: row.status,
        })),
    );
    if (latestRecommendation !== null) {
        signals.push({
            // Recommendation statuses share names with applicant stages.
            stage: latestRecommendation.status,
            at: latestRecommendation.at,
            id: latestRecommendation.id,
            detail: `Recommendation #${latestRecommendation.id}: ${latestRecommendation.status}`,
        });
    }

    // Ported `hasGradedFinal`: only a graded (Passed/Failed) Final moves the
    // recommendation out of the pending set; Pending finals stay
    // eligible-display and surface as "Final Pending".
    const gradedFinals = input.finalInterviews.filter(
        (row) => row.verdict === "Passed" || row.verdict === "Failed",
    );
    const pendingFinals = input.finalInterviews.filter(
        (row) => row.verdict === "Pending",
    );
    const latestGraded = latestBy(
        gradedFinals.map((row) => ({
            at: row.created_at,
            id: row.id,
            verdict: row.verdict,
        })),
    );
    if (latestGraded !== null) {
        signals.push({
            stage: finalStageFor(latestGraded.verdict),
            at: latestGraded.at,
            id: latestGraded.id,
            detail: `Final interview #${latestGraded.id}: ${latestGraded.verdict}`,
        });
    } else {
        const latestPending = latestBy(
            pendingFinals.map((row) => ({
                at: row.created_at,
                id: row.id,
                verdict: row.verdict,
            })),
        );
        if (latestPending !== null) {
            signals.push({
                stage: "Final Pending",
                at: latestPending.at,
                id: latestPending.id,
                detail: `Final interview #${latestPending.id}: awaiting verdict`,
            });
        }
    }

    let winner = signals[0];
    for (const signal of signals) {
        if (winner === undefined) {
            winner = signal;
            continue;
        }
        const rankDiff = rankOf(signal.stage) - rankOf(winner.stage);
        if (rankDiff > 0 || (rankDiff === 0 && compareRecency(signal, winner) > 0)) {
            winner = signal;
        }
    }

    const timeline: StageTimelineEvent[] = [...signals]
        .sort((a, b) => {
            const aAt = a.at ?? "";
            const bAt = b.at ?? "";
            if (aAt !== bAt) return aAt < bAt ? -1 : 1;
            return a.id - b.id;
        })
        .map((signal) => ({ stage: signal.stage, at: signal.at, detail: signal.detail }));

    return { stage: winner?.stage ?? "Initial Pending", timeline };
}
