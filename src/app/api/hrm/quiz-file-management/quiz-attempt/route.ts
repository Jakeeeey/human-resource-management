import { NextRequest, NextResponse } from "next/server";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";
import { gradeAnswers, persistGradedAttempt, type AnswerInput } from "@/lib/quiz-file-management/grading";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const LIMIT = 1000;

const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

async function dFetch(path: string, options?: RequestInit) {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${STATIC_TOKEN}`,
            ...(options?.headers || {}),
        },
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("DIRECTUS ERROR:", text);
        try {
            return JSON.parse(text);
        } catch {
            throw new Error(text);
        }
    }

    if (res.status === 204) {
        return null;
    }

    return res.json();
}

export async function GET() {
    try {
        const attemptsRes = await dFetch(`/items/quiz_attempt?limit=${LIMIT}&sort=-created_at`);
        if (attemptsRes.error) {
            return NextResponse.json({ error: attemptsRes.error }, { status: 500 });
        }

        const attempts = attemptsRes.data || [];
        if (!attempts.length) {
            return NextResponse.json({ attempts: [] });
        }

        const quizIds = [...new Set(attempts.map((a: { quiz_id: number }) => a.quiz_id))];
        const applicantIds = [...new Set(attempts.map((a: { applicant_id: number }) => a.applicant_id))];

        const [quizzesRes, applicantsRes] = await Promise.all([
            dFetch(`/items/quiz?filter[id][_in]=${quizIds.join(",")}&fields=id,name`),
            dFetch(`/items/applicant?filter[id][_in]=${applicantIds.join(",")}&fields=id,full_name,position_applied_for`),
        ]);

        const quizzesById = new Map(
            (quizzesRes.data || []).map((q: { id: number; name: string }) => [q.id, q])
        );
        const applicantsById = new Map(
            (applicantsRes.data || []).map((a: { id: number }) => [a.id, a])
        );

        const enriched = attempts.map((a: { quiz_id: number; applicant_id: number; [key: string]: unknown }) => ({
            ...a,
            quiz: quizzesById.get(a.quiz_id) || null,
            applicant: applicantsById.get(a.applicant_id) || null,
        }));

        return NextResponse.json({ attempts: enriched });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { quiz_id, applicant_id, application_id, started_at, answers } = body as {
            quiz_id: number;
            applicant_id: number;
            application_id?: number | null;
            started_at?: string;
            answers: AnswerInput[];
        };

        if (!quiz_id || !applicant_id || !Array.isArray(answers) || !answers.length) {
            return NextResponse.json(
                { error: "quiz_id, applicant_id, and a non-empty answers array are required" },
                { status: 400 }
            );
        }

        const token = req.cookies.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        const administeredBy = payload?.sub ? Number(payload.sub) || null : null;

        const outcome = await gradeAnswers(quiz_id, answers);
        if (!outcome.ok) {
            return NextResponse.json({ error: outcome.error }, { status: outcome.status });
        }

        const attempt = await persistGradedAttempt({
            quizId: quiz_id,
            applicantId: applicant_id,
            applicationId: application_id ?? null,
            administeredBy,
            startedAt: started_at ?? null,
            grade: outcome,
        });

        // Continuity write-back: the applicant flow (application form -> quiz)
        // stamps the quiz result onto the application row so the future HR list
        // view has it without a join. A failure here must not fail the attempt
        // that was already saved.
        if (application_id) {
            try {
                await dFetch(`/items/application/${application_id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        quiz_score: outcome.score,
                        quiz_passed: outcome.passed,
                        status: "Quiz Completed",
                    }),
                });
            } catch (writeBackErr) {
                console.error(
                    "[quiz-attempt] application write-back failed for application_id",
                    application_id,
                    writeBackErr
                );
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                ...attempt,
                score: outcome.score,
                percentage_score: outcome.percentageScore,
                passed: outcome.passed,
            },
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}
