import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { interviewService, nowPH, maybeAutoApproveRecommendation } from "@/modules/human-resource-management/recruitment/interviews/services/interview.service";
import { manpowerRecommendationService } from "@/modules/human-resource-management/recruitment/manpower-recommendation/services/manpowerRecommendation.service";
import { InterviewSchema } from "@/modules/human-resource-management/recruitment/interviews/types";
import { deriveScheduleStage, findUngradedInterview } from "@/modules/human-resource-management/recruitment/interviews/utils/schedule-stage";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_access_token";

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

        const [list, quizApps, recommendedRecs, users] = await Promise.all([
            interviewService.fetchInterviews(),
            interviewService.fetchQuizCompletedApplications(),
            interviewService.fetchRecommendedRecommendations(),
            manpowerRecommendationService.fetchUsers(),
        ]);
        const interviews = list.interviews;

        // Eligible Initial: every quiz-completed application whose applicant holds
        // NO Recommended rec and has NO Final-stage interview yet (both already
        // surface on the Final tab — the Initial tab would duplicate what
        // History already shows). Annotated with its latest
        // Initial-stage verdict (null when never graded) plus its
        // latest quiz_attempt id + percentage (application-scoped lookup with
        // applicant-id fallback — older attempts predate the nullable
        // application_id link). full_name arrives from the service applicant
        // lookup; defensively coerce to a real string so the UI never receives
        // null/undefined (Applicant #id fallback only when the name is truly
        // missing).
        const finalApplicantIds = new Set<number>();
        for (const i of interviews) {
            if (i.stage !== "Final") continue;
            const owner = quizApps.find((a) => a.id === i.application_id);
            if (owner) finalApplicantIds.add(owner.applicant_id);
        }
        for (const rec of recommendedRecs) {
            if (rec.applicant_id !== null) finalApplicantIds.add(rec.applicant_id);
        }
        const initialApps = quizApps.filter((app) => !finalApplicantIds.has(app.applicant_id));
        const latestAttempts = await Promise.all(
            initialApps.map((app) => interviewService.fetchLatestQuizAttempt(app.id, app.applicant_id)),
        );
        const eligibleInitial = initialApps.map((app, index) => {
            const initials = interviews
                .filter((i) => i.stage === "Initial" && i.application_id === app.id)
                .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
            const latestAttempt = latestAttempts[index];
            return { ...app, full_name: app.full_name || `Applicant #${app.applicant_id}`, latestInitialVerdict: initials[0]?.verdict ?? null, quiz_attempt_id: latestAttempt?.id ?? null, quiz_attempt_percentage: latestAttempt?.percentage_score ?? null, quiz_attempt_passed: latestAttempt?.passed ?? null };
        });

        // Eligible Final: ALL Recommended recs on Approved requests — every final
        // (Passed, Failed, Pending) stays displayed for transparent records.
        // REC-SCOPED, never applicant-scoped.
        const eligibleFinal = recommendedRecs
            .map((rec) => {
                const finals = interviews
                    .filter((i) => i.stage === "Final" && i.recommendation_id === rec.id)
                    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
                return { ...rec, full_name: rec.full_name ?? "Unknown applicant", latestFinalVerdict: finals[0]?.verdict ?? null, position: list.requests.find((q) => q.id === rec.manpower_request_id)?.position ?? null };
            });

        return NextResponse.json({ data: interviews, eligibleInitial, eligibleFinal, users });
    } catch (e: unknown) {
        const err = e as Error;
        if (err && typeof err === "object" && "issues" in err) {
            return NextResponse.json({ error: "VALIDATION_FAILED", message: err.message }, { status: 400 });
        }
        const message = err.message || "INTERNAL_FAIL";
        return NextResponse.json({ error: toErrorCode(message), message: humanMessage(message) }, { status: toStatusCode(message) });
    }
}

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token: string | undefined = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const raw = payload?.id || payload?.user_id || payload?.sub;
        const userId = typeof raw === "string" ? parseInt(raw, 10) : raw;
        if (!userId) {
            return NextResponse.json({ error: "AUTH_DENIED" }, { status: 401 });
        }

        const body = await req.json();

        // Schedule-only path: creates a Pending interview row with no sheet
        // (stage derived server-side via the shared helper, never trusted
        // from the client). Sheet creation stays in grading only. Dedupe: an
        // ungraded row for the derived app + stage is returned with
        // reused:true instead of creating a duplicate.
        if (body.schedule === true) {
            const applicationId = body.application_id;
            if (typeof applicationId !== "number") {
                return NextResponse.json({ error: "VALIDATION_FAILED", message: "Please select an applicant to schedule." }, { status: 400 });
            }
            const [list, quizApps, recommendedRecs] = await Promise.all([
                interviewService.fetchInterviews(),
                interviewService.fetchQuizCompletedApplications(),
                interviewService.fetchRecommendedRecommendations(),
            ]);
            const quizApp = quizApps.find((a) => a.id === applicationId);
            if (!quizApp) {
                return NextResponse.json({ error: "VALIDATION_FAILED", message: `Application #${applicationId} has not completed the quiz. Interviews open after quiz completion.` }, { status: 400 });
            }
            const stage = deriveScheduleStage(applicationId, list.interviews);
            if (stage === null) {
                return NextResponse.json({ error: "VALIDATION_FAILED", message: "This applicant already passed the final interview and cannot be scheduled again." }, { status: 400 });
            }
            const existing = findUngradedInterview(applicationId, stage, list.interviews);
            if (existing) {
                return NextResponse.json({ data: existing, reused: true }, { status: 200 });
            }
            let recommendation_id: number | null = null;
            let manpower_request_id: number | null = null;
            if (stage === "Final") {
                // Latest Recommended recommendation for the applicant (list is
                // newest-first, so the first match wins). The lookup is
                // already scoped to Recommended recs on Approved requests, which
                // is the Final guard by construction.
                const rec = recommendedRecs.find((r) => r.applicant_id === quizApp.applicant_id) ?? null;
                if (!rec) {
                    return NextResponse.json({ error: "VALIDATION_FAILED", message: "No recommendation found for this applicant. Final interviews open after recommendation." }, { status: 400 });
                }
                recommendation_id = rec.id;
                manpower_request_id = rec.manpower_request_id;
            }
            const created = await interviewService.createScheduledInterview({
                stage,
                application_id: applicationId,
                manpower_request_id,
                recommendation_id,
            });
            return NextResponse.json({ data: created, reused: false }, { status: 201 });
        }

        body.interviewed_by = userId;
        body.interviewed_at = nowPH();

        const validated = InterviewSchema.parse(body);

        // Initial guard: only applications with Quiz Completed status are accepted.
        if (validated.stage === "Initial") {
            const quizApps = await interviewService.fetchQuizCompletedApplications();
            if (!quizApps.some((a) => a.id === validated.application_id)) {
                return NextResponse.json({ error: "VALIDATION_FAILED", message: `Application #${validated.application_id} has not completed the quiz. Initial interviews open after quiz completion.` }, { status: 400 });
            }
        }

        // Final guard: only Recommended recommendations on Approved requests are accepted.
        if (validated.stage === "Final") {
            const rec = validated.recommendation_id
                ? await manpowerRecommendationService.fetchById(validated.recommendation_id)
                : null;
            if (!rec || rec.status !== "Recommended") {
                return NextResponse.json({ error: "VALIDATION_FAILED", message: `Recommendation #${validated.recommendation_id ?? "?"} is not a pending recommendation. Final interviews open after recommendation.` }, { status: 400 });
            }
            const { status, request_no } = await manpowerRecommendationService.fetchRequestStatus(rec.manpower_request_id);
            if (status !== "Approved") {
                return NextResponse.json({ error: "VALIDATION_FAILED", message: `Request ${request_no} is still pending approval. Final interviews open after approval.` }, { status: 400 });
            }
        }

        const items = body.items;
        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "VALIDATION_FAILED", message: "At least one criterion score is required to submit interview grading." }, { status: 400 });
        }

        const created = await interviewService.createInterviewFlow({ ...validated, items });
        const autoApproved =
            created.stage === "Final" && created.verdict === "Passed"
                ? await maybeAutoApproveRecommendation(created.recommendation_id)
                : false;
        return NextResponse.json({ data: created, autoApproved }, { status: 201 });
    } catch (e: unknown) {
        const err = e as Error;
        if (err && typeof err === "object" && "issues" in err) {
            return NextResponse.json({ error: "VALIDATION_FAILED", message: err.message }, { status: 400 });
        }
        const message = err.message || "INTERNAL_FAIL";
        return NextResponse.json({ error: toErrorCode(message), message: humanMessage(message) }, { status: toStatusCode(message) });
    }
}
