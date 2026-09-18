import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
    ApplicantStatusSchema,
    type ApplicantStatus,
} from "@/modules/human-resource-management/onboarding/types/applicant-status";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

/** One real pipeline event, replayed from an `interview` / `manpower_recommendation` row. */
export type ApplicantTimelineEvent = {
    /** Source row id (unique within `kind`). */
    id: number;
    kind: "initial_interview" | "final_interview" | "recommendation";
    /** Row `created_at`, or null when Directus returns none. */
    at: string | null;
    detail: string;
};

/**
 * One row per applicant for the Applicants overview table.
 * `status` is `applicant.status` verbatim — the single status truth. There is
 * no history table, so `timeline` replays the retained `interview` /
 * `manpower_recommendation` rows only; nothing is derived or fabricated.
 */
export type ApplicantRow = {
    id: number;
    full_name: string;
    position_applied_for: string | null;
    /** Latest application id (submitted_at desc, id desc tiebreak); null when never applied. */
    application_id: number | null;
    submitted_at: string | null;
    quiz_score: number | null;
    quiz_passed: boolean | null;
    /** Canonical snake_case `ApplicantStatus`; null when the row's value is not canonical. */
    status: ApplicantStatus | null;
    timeline: ApplicantTimelineEvent[];
};

type RawApplicant = {
    id: number;
    full_name: string;
    position_applied_for: string | null;
    status: string | null;
};

type RawApplication = {
    id: number;
    applicant_id: number;
    submitted_at: string | null;
    quiz_score: number | null;
    quiz_passed: boolean | number | null;
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

type InterviewVerdict = "Pending" | "Passed" | "Failed";

type RecommendationStatus =
    | "Recommended"
    | "Approved"
    | "Hired"
    | "Rejected"
    | "Withdrawn";

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

        // Single-pass aggregate: one batched fan-out, then in-memory joins only.
        // `applicant.status` is read directly (the single status truth); the
        // timeline is built from retained interview / recommendation rows only.
        const [applicantRes, appRes, interviewRes, recRes] = await Promise.all([
            dFetch(`/items/applicant?fields=id,full_name,position_applied_for,status&sort=full_name&limit=-1`),
            dFetch(`/items/application?fields=id,applicant_id,submitted_at,quiz_score,quiz_passed&sort=-submitted_at&limit=-1`),
            dFetch(`/items/interview?fields=id,application_id,recommendation_id,stage,verdict,created_at&sort=-created_at&limit=-1`),
            dFetch(`/items/manpower_recommendation?fields=id,applicant_id,status,created_at&sort=-created_at&limit=-1`),
        ]);

        const applicants = ((applicantRes as { data?: RawApplicant[] })?.data ?? []) as RawApplicant[];
        const applications = ((appRes as { data?: RawApplication[] })?.data ?? []) as RawApplication[];
        const interviews = ((interviewRes as { data?: RawInterview[] })?.data ?? []) as RawInterview[];
        const recommendations = ((recRes as { data?: RawRecommendation[] })?.data ?? []) as RawRecommendation[];

        const appsByApplicant = new Map<number, RawApplication[]>();
        for (const app of applications) {
            if (typeof app.applicant_id !== "number") continue;
            const list = appsByApplicant.get(app.applicant_id);
            if (list) list.push(app);
            else appsByApplicant.set(app.applicant_id, [app]);
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

            const applicantRecs = recsByApplicant.get(applicant.id) ?? [];
            const applicantRecIds = new Set(applicantRecs.map((rec) => rec.id));
            const applicantFinals: RawInterview[] = [];
            for (const recId of applicantRecIds) {
                const finals = finalsByRecommendation.get(recId);
                if (finals) applicantFinals.push(...finals);
            }

            // Real events only: one entry per retained interview / recommendation
            // row, oldest-first (`created_at` asc, id asc tiebreak).
            const timeline: ApplicantTimelineEvent[] = [
                ...(latestApp !== null ? (initialsByApplication.get(latestApp.id) ?? []) : []).map(
                    (row): ApplicantTimelineEvent => ({
                        id: row.id,
                        kind: "initial_interview",
                        at: row.created_at,
                        detail: `Initial interview #${row.id}: ${row.verdict}`,
                    }),
                ),
                ...applicantRecs.map(
                    (rec): ApplicantTimelineEvent => ({
                        id: rec.id,
                        kind: "recommendation",
                        at: rec.created_at,
                        detail: `Recommendation #${rec.id}: ${rec.status}`,
                    }),
                ),
                ...applicantFinals.map(
                    (row): ApplicantTimelineEvent => ({
                        id: row.id,
                        kind: "final_interview",
                        at: row.created_at,
                        detail: `Final interview #${row.id}: ${row.verdict}`,
                    }),
                ),
            ].sort((a, b) => {
                const aAt = a.at ?? "";
                const bAt = b.at ?? "";
                if (aAt !== bAt) return aAt < bAt ? -1 : 1;
                return a.id - b.id;
            });

            // Boundary parse: a non-canonical/absent value becomes null (rendered
            // as a placeholder) instead of leaking an unknown string downstream.
            const parsedStatus = ApplicantStatusSchema.safeParse(applicant.status);

            return {
                id: applicant.id,
                full_name: applicant.full_name,
                position_applied_for: applicant.position_applied_for,
                application_id: latestApp?.id ?? null,
                submitted_at: latestApp?.submitted_at ?? null,
                quiz_score: latestApp?.quiz_score ?? null,
                quiz_passed: toNullableBoolean(latestApp?.quiz_passed ?? null),
                status: parsedStatus.success ? parsedStatus.data : null,
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
