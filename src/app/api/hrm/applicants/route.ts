import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { manpowerRecommendationService } from "@/modules/human-resource-management/recruitment/manpower-recommendation/services/manpowerRecommendation.service";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
    deriveApplicantStage,
    type ApplicantStage,
    type InterviewVerdict,
    type RecommendationStatus,
    type StageTimelineEvent,
} from "@/modules/human-resource-management/recruitment/applicants/lib/deriveApplicantStage";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

/**
 * One row per applicant for the Applicants overview table.
 * `stage`/`timeline` are server-derived via `deriveApplicantStage` only —
 * the client renders `stage` verbatim and never recomputes it.
 */
export type ApplicantRow = {
    id: number;
    full_name: string;
    position_applied_for: string;
    /** Latest application id (submitted_at desc, id desc tiebreak); null when never applied. */
    application_id: number | null;
    submitted_at: string | null;
    quiz_score: number | null;
    quiz_passed: boolean | null;
    stage: ApplicantStage;
    timeline: StageTimelineEvent[];
};

type RawApplication = {
    id: number;
    applicant_id: number;
    submitted_at: string | null;
    quiz_score: number | null;
    quiz_passed: boolean | number | null;
};

type RawQuizAttempt = {
    id: number;
    application_id: number | null;
    applicant_id: number | null;
    passed: boolean | number | null;
    completed_at: string | null;
    created_at: string | null;
};

type RawInterview = {
    id: number;
    application_id: number | null;
    recommendation_id: number | null;
    stage: string;
    verdict: string;
    created_at: string | null;
};

type RawRecommendation = {
    id: number;
    applicant_id: number | null;
    status: string;
    created_at: string | null;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        if (!token) return null;
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const p = parts[1];
        const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const json = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function toStatusCode(message: string): number {
    if (message.startsWith("AUTH_DENIED")) return 401;
    if (message.startsWith("VALIDATION_FAILED")) return 400;
    return 500;
}

function toErrorCode(message: string): string {
    if (message.startsWith("AUTH_DENIED")) return "AUTH_DENIED";
    if (message.startsWith("VALIDATION_FAILED")) return "VALIDATION_FAILED";
    return "INTERNAL_FAIL";
}

function humanMessage(message: string): string {
    return message.replace(/^[A-Z_]+:\s*/, "");
}

function isVerdict(value: string): value is InterviewVerdict {
    return value === "Pending" || value === "Passed" || value === "Failed";
}

function isRecommendationStatus(value: string): value is RecommendationStatus {
    return (
        value === "Recommended" ||
        value === "Approved" ||
        value === "Hired" ||
        value === "Rejected" ||
        value === "Withdrawn"
    );
}

function toNullableBoolean(value: boolean | number | null): boolean | null {
    if (value === null || value === undefined) return null;
    return Boolean(value);
}

/**
 * Latest-wins pick: later timestamp wins, null/empty counts as oldest,
 * `id` desc breaks ties.
 */
function pickLatest<T extends { id: number }>(rows: T[], atOf: (row: T) => string | null): T | null {
    let best: T | null = null;
    for (const row of rows) {
        if (best === null) {
            best = row;
            continue;
        }
        const aAt = atOf(row) ?? "";
        const bAt = atOf(best) ?? "";
        if (aAt !== bAt) {
            if (aAt > bAt) best = row;
        } else if (row.id > best.id) {
            best = row;
        }
    }
    return best;
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token: string | undefined = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const raw = payload?.id || payload?.user_id || payload?.sub;
        const userId = typeof raw === "string" ? parseInt(raw, 10) : raw;
        if (!userId) {
            return NextResponse.json({ error: "AUTH_DENIED" }, { status: 401 });
        }

        // Single-pass aggregate: one batched fan-out (same shape as
        // interviews/route.ts Promise.all), then in-memory joins only.
        // No per-applicant/per-row service calls.
        const [applicants, appRes, attemptRes, interviewRes, recRes] = await Promise.all([
            manpowerRecommendationService.fetchApplicants(),
            dFetch(`/items/application?fields=id,applicant_id,submitted_at,quiz_score,quiz_passed&sort=-submitted_at&limit=-1`),
            dFetch(`/items/quiz_attempt?fields=id,application_id,applicant_id,passed,completed_at,created_at&sort=-completed_at&limit=-1`),
            dFetch(`/items/interview?fields=id,application_id,recommendation_id,stage,verdict,created_at&sort=-created_at&limit=-1`),
            dFetch(`/items/manpower_recommendation?fields=id,applicant_id,status,created_at&sort=-created_at&limit=-1`),
        ]);

        const applications = ((appRes as { data?: RawApplication[] })?.data ?? []) as RawApplication[];
        const attempts = ((attemptRes as { data?: RawQuizAttempt[] })?.data ?? []) as RawQuizAttempt[];
        const interviews = ((interviewRes as { data?: RawInterview[] })?.data ?? []) as RawInterview[];
        const recommendations = ((recRes as { data?: RawRecommendation[] })?.data ?? []) as RawRecommendation[];

        const appsByApplicant = new Map<number, RawApplication[]>();
        for (const app of applications) {
            if (typeof app.applicant_id !== "number") continue;
            const list = appsByApplicant.get(app.applicant_id);
            if (list) list.push(app);
            else appsByApplicant.set(app.applicant_id, [app]);
        }

        const attemptsByApplication = new Map<number, RawQuizAttempt[]>();
        const attemptsByApplicant = new Map<number, RawQuizAttempt[]>();
        for (const attempt of attempts) {
            if (typeof attempt.application_id === "number") {
                const list = attemptsByApplication.get(attempt.application_id);
                if (list) list.push(attempt);
                else attemptsByApplication.set(attempt.application_id, [attempt]);
            }
            if (typeof attempt.applicant_id === "number") {
                const list = attemptsByApplicant.get(attempt.applicant_id);
                if (list) list.push(attempt);
                else attemptsByApplicant.set(attempt.applicant_id, [attempt]);
            }
        }

        const initialsByApplication = new Map<number, RawInterview[]>();
        const finalsByRecommendation = new Map<number, RawInterview[]>();
        for (const interview of interviews) {
            if (!isVerdict(interview.verdict)) continue;
            if (interview.stage === "Initial" && typeof interview.application_id === "number") {
                const list = initialsByApplication.get(interview.application_id);
                if (list) list.push(interview);
                else initialsByApplication.set(interview.application_id, [interview]);
            } else if (interview.stage === "Final" && typeof interview.recommendation_id === "number") {
                const list = finalsByRecommendation.get(interview.recommendation_id);
                if (list) list.push(interview);
                else finalsByRecommendation.set(interview.recommendation_id, [interview]);
            }
        }

        const recsByApplicant = new Map<number, RawRecommendation[]>();
        for (const rec of recommendations) {
            if (typeof rec.applicant_id !== "number" || !isRecommendationStatus(rec.status)) continue;
            const list = recsByApplicant.get(rec.applicant_id);
            if (list) list.push(rec);
            else recsByApplicant.set(rec.applicant_id, [rec]);
        }

        const data: ApplicantRow[] = applicants.map((applicant) => {
            // Latest application wins: submitted_at desc, id desc tiebreak.
            const latestApp = pickLatest(appsByApplicant.get(applicant.id) ?? [], (row) => row.submitted_at);

            // Latest quiz attempt for the latest application (application-scoped
            // match wins; applicant fallback mirrors fetchLatestQuizAttempt).
            const scopedAttempts =
                (latestApp !== null ? (attemptsByApplication.get(latestApp.id) ?? []) : []).length > 0
                    ? (attemptsByApplication.get(latestApp?.id ?? -1) ?? [])
                    : (attemptsByApplicant.get(applicant.id) ?? []);
            const latestAttempt = pickLatest(scopedAttempts, (row) => row.completed_at ?? row.created_at);

            const applicantRecs = recsByApplicant.get(applicant.id) ?? [];
            const applicantRecIds = new Set(applicantRecs.map((rec) => rec.id));
            const applicantFinals: RawInterview[] = [];
            for (const recId of applicantRecIds) {
                const finals = finalsByRecommendation.get(recId);
                if (finals) applicantFinals.push(...finals);
            }

            const { stage, timeline } = deriveApplicantStage({
                application:
                    latestApp === null
                        ? null
                        : {
                              id: latestApp.id,
                              submitted_at: latestApp.submitted_at,
                              quiz_passed: toNullableBoolean(latestApp.quiz_passed),
                          },
                quizAttempt:
                    latestAttempt === null
                        ? null
                        : {
                              id: latestAttempt.id,
                              passed: toNullableBoolean(latestAttempt.passed),
                              created_at: latestAttempt.completed_at ?? latestAttempt.created_at,
                          },
                initialInterviews: (latestApp !== null ? (initialsByApplication.get(latestApp.id) ?? []) : []).map(
                    (row) => ({
                        id: row.id,
                        recommendation_id: row.recommendation_id,
                        verdict: row.verdict as InterviewVerdict,
                        created_at: row.created_at,
                    }),
                ),
                recommendations: applicantRecs.map((rec) => ({
                    id: rec.id,
                    status: rec.status as RecommendationStatus,
                    created_at: rec.created_at,
                })),
                finalInterviews: applicantFinals.map((row) => ({
                    id: row.id,
                    recommendation_id: row.recommendation_id,
                    verdict: row.verdict as InterviewVerdict,
                    created_at: row.created_at,
                })),
            });

            return {
                id: applicant.id,
                full_name: applicant.full_name,
                position_applied_for: applicant.position_applied_for,
                application_id: latestApp?.id ?? null,
                submitted_at: latestApp?.submitted_at ?? null,
                quiz_score: latestApp?.quiz_score ?? null,
                quiz_passed: toNullableBoolean(latestApp?.quiz_passed ?? null),
                stage,
                timeline,
            };
        });

        return NextResponse.json({ data });
    } catch (e: unknown) {
        const err = e as Error;
        if (err && typeof err === "object" && "issues" in err) {
            return NextResponse.json({ error: "VALIDATION_FAILED", message: err.message }, { status: 400 });
        }
        const message = err.message || "INTERNAL_FAIL";
        return NextResponse.json({ error: toErrorCode(message), message: humanMessage(message) }, { status: toStatusCode(message) });
    }
}
