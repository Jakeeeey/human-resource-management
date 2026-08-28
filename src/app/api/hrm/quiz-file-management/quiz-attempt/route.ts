import { NextRequest, NextResponse } from "next/server";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";

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

const CHOICE_TYPES = new Set(["true_false", "multiple_choice"]);

function normalize(text: string): string {
    return text.trim().toLowerCase();
}

interface AnswerInput {
    question_id: number;
    // text questions
    blank_index?: number;
    answer_given_text?: string;
    // choice questions
    answer_given_choice_id?: number | null;
    presented_choice_ids?: number[];
}

interface QuizRecord {
    id: number;
    number_of_questions: number;
    pass_threshold_value: number;
    [key: string]: unknown;
}

interface QuestionRecord {
    id: number;
    question_type: string;
    question_text: string;
    [key: string]: unknown;
}

interface ChoiceRecord {
    id: number;
    question_id: number;
    option_text: string | null;
    option_image: string | null;
    is_correct: boolean;
    sort: number | null;
    [key: string]: unknown;
}

// Frozen copy of a question's answer key, written per answer row at grading
// time so the breakdown stays accurate even if the pool question is later
// edited or deleted -- same reasoning as question_text_snapshot. Choice options
// are stored in the order the applicant saw them (from presented_choice_ids) so
// the breakdown's A/B/C/D labels line up.
type AnswerKeySnapshot =
    | {
          kind: "choice";
          options: { id: number; text: string | null; image: string | null; is_correct: boolean }[];
          given_choice_id: number | null;
      }
    | { kind: "text"; blank_index: number; accepted: string[] };

interface ExpectedAnswerRecord {
    id: number;
    question_id: number;
    blank_index: number;
    expected_answer_text: string;
    [key: string]: unknown;
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
        const { quiz_id, applicant_id, started_at, answers } = body as {
            quiz_id: number;
            applicant_id: number;
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

        const quizRes: QuizRecord = (await dFetch(`/items/quiz/${quiz_id}`))?.data;
        if (!quizRes) {
            return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
        }

        const questionIds = [...new Set(answers.map((a) => a.question_id))];
        const [questionsRes, choicesRes, expectedRes] = await Promise.all([
            dFetch(`/items/quiz_question?filter[id][_in]=${questionIds.join(",")}`),
            dFetch(`/items/quiz_question_choice?filter[question_id][_in]=${questionIds.join(",")}`),
            dFetch(`/items/quiz_question_expected_answer?filter[question_id][_in]=${questionIds.join(",")}`),
        ]);

        const questionsById = new Map<number, QuestionRecord>(
            (questionsRes.data || []).map((q: QuestionRecord) => [q.id, q])
        );

        const choicesByQuestionId = new Map<number, ChoiceRecord[]>();
        for (const c of (choicesRes.data || []) as ChoiceRecord[]) {
            const list = choicesByQuestionId.get(c.question_id) || [];
            list.push(c);
            choicesByQuestionId.set(c.question_id, list);
        }

        const expectedByKey = new Map<string, ExpectedAnswerRecord[]>();
        for (const e of (expectedRes.data || []) as ExpectedAnswerRecord[]) {
            const key = `${e.question_id}:${e.blank_index}`;
            const list = expectedByKey.get(key) || [];
            list.push(e);
            expectedByKey.set(key, list);
        }

        const gradedAnswers = answers.map((a) => {
            const blankIndex = a.blank_index ?? 0;
            const question = questionsById.get(a.question_id);
            const questionType = question?.question_type || "unknown";

            let isCorrect = false;
            let answerKeySnapshot: AnswerKeySnapshot | null = null;
            let answerGivenText: string | null = a.answer_given_text ?? null;
            let answerGivenChoiceId: number | null = null;

            if (question) {
                if (CHOICE_TYPES.has(questionType)) {
                    const byId = new Map(
                        (choicesByQuestionId.get(a.question_id) || []).map((c) => [c.id, c])
                    );
                    answerGivenChoiceId = a.answer_given_choice_id ?? null;

                    // Correctness is keyed on the picked choice's id -- never on text.
                    const picked =
                        answerGivenChoiceId != null ? byId.get(answerGivenChoiceId) : undefined;
                    isCorrect = Boolean(picked?.is_correct);
                    // Keep answer_given_text as a human-readable label for the DB row.
                    answerGivenText = picked
                        ? picked.option_text ?? "[image]"
                        : null;

                    // Freeze options in the order the applicant saw them; fall back
                    // to sort order if the client sent no presented order.
                    const orderIds =
                        a.presented_choice_ids && a.presented_choice_ids.length
                            ? a.presented_choice_ids
                            : [...byId.values()]
                                  .sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0) || x.id - y.id)
                                  .map((c) => c.id);

                    answerKeySnapshot = {
                        kind: "choice",
                        options: orderIds
                            .map((id) => byId.get(id))
                            .filter((c): c is ChoiceRecord => Boolean(c))
                            .map((c) => ({
                                id: c.id,
                                text: c.option_text,
                                image: c.option_image,
                                is_correct: Boolean(c.is_correct),
                            })),
                        given_choice_id: answerGivenChoiceId,
                    };
                } else {
                    const accepted = expectedByKey.get(`${a.question_id}:${blankIndex}`) || [];
                    const givenText = a.answer_given_text ?? "";
                    isCorrect = accepted.some(
                        (e) => normalize(e.expected_answer_text) === normalize(givenText)
                    );
                    answerGivenText = givenText;
                    answerKeySnapshot = {
                        kind: "text",
                        blank_index: blankIndex,
                        accepted: accepted.map((e) => e.expected_answer_text),
                    };
                }
            }

            return {
                question_id: a.question_id,
                question_text_snapshot: question?.question_text || "[question no longer in pool]",
                question_type: questionType,
                answer_given_text: answerGivenText,
                answer_given_choice_id: answerGivenChoiceId,
                is_correct: isCorrect,
                answer_key_snapshot: answerKeySnapshot,
            };
        });

        // All-or-nothing per question: a question scores 1 only if every one of
        // its answer rows is correct (fill-in-the-blank writes one row per blank).
        const questionAllCorrect = new Map<number, boolean>();
        for (const row of gradedAnswers) {
            const prior = questionAllCorrect.get(row.question_id);
            questionAllCorrect.set(row.question_id, (prior ?? true) && row.is_correct);
        }
        let score = 0;
        for (const allCorrect of questionAllCorrect.values()) {
            if (allCorrect) score += 1;
        }

        const numberOfQuestionsSnapshot = quizRes.number_of_questions;
        const passThresholdSnapshot = quizRes.pass_threshold_value;
        const percentageScore = Math.round((score / numberOfQuestionsSnapshot) * 10000) / 100;
        const passed = percentageScore >= passThresholdSnapshot;

        const createdAttempt = await dFetch(`/items/quiz_attempt`, {
            method: "POST",
            body: JSON.stringify({
                quiz_id,
                applicant_id,
                administered_by: administeredBy,
                number_of_questions_snapshot: numberOfQuestionsSnapshot,
                pass_threshold_value_snapshot: passThresholdSnapshot,
                score,
                percentage_score: percentageScore,
                passed,
                started_at: started_at || null,
                completed_at: new Date().toISOString(),
            }),
        });

        const attemptId = createdAttempt?.data?.id;
        if (attemptId) {
            // Single batch insert (not Promise.all) so the rows keep answer
            // order -- the breakdown groups by first-seen row per question, and
            // a lost row now fails the whole call instead of being swallowed.
            await dFetch(`/items/quiz_attempt_answer`, {
                method: "POST",
                body: JSON.stringify(
                    gradedAnswers.map((ans) => ({ attempt_id: attemptId, ...ans }))
                ),
            });
        }

        return NextResponse.json({
            success: true,
            data: { ...createdAttempt?.data, score, percentage_score: percentageScore, passed },
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}
