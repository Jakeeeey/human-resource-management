// Shared grading for a submitted quiz attempt.
//
// Extracted verbatim from the POST handler of
// `src/app/api/hrm/quiz-file-management/quiz-attempt/route.ts` so any caller
// grades, snapshots and persists attempts through one implementation.
// Correctness of a choice question is keyed on the picked choice's id, never
// its text.

import { dFetch } from "./directus";

const CHOICE_TYPES = new Set(["true_false", "multiple_choice"]);

function normalize(text: string): string {
    return text.trim().toLowerCase();
}

export interface AnswerInput {
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

interface ExpectedAnswerRecord {
    id: number;
    question_id: number;
    blank_index: number;
    expected_answer_text: string;
    [key: string]: unknown;
}

// Frozen copy of a question's answer key, written per answer row at grading time
// so the breakdown stays accurate even if the pool question is later edited or
// deleted -- same reasoning as question_text_snapshot. Choice options are stored
// in the order the applicant saw them (from presented_choice_ids) so the
// breakdown's A/B/C/D labels line up.
export type AnswerKeySnapshot =
    | {
          kind: "choice";
          options: { id: number; text: string | null; image: string | null; is_correct: boolean }[];
          given_choice_id: number | null;
      }
    | { kind: "text"; blank_index: number; accepted: string[] };

export interface GradedAnswerRow {
    question_id: number;
    question_text_snapshot: string;
    question_type: string;
    answer_given_text: string | null;
    answer_given_choice_id: number | null;
    is_correct: boolean;
    answer_key_snapshot: AnswerKeySnapshot | null;
}

export interface GradeResult {
    gradedAnswers: GradedAnswerRow[];
    score: number;
    percentageScore: number;
    passed: boolean;
    numberOfQuestionsSnapshot: number;
    passThresholdSnapshot: number;
}

export type GradeOutcome =
    | ({ ok: true } & GradeResult)
    | { ok: false; status: number; error: string };

/**
 * Grades `answers` against the quiz identified by `quizId`. Fetches the quiz and
 * every referenced question / choice / expected-answer, computes per-row
 * correctness + a frozen answer-key snapshot, then an all-or-nothing per-question
 * score. Returns `{ ok: false, status: 404 }` if the quiz is gone.
 */
export async function gradeAnswers(
    quizId: number,
    answers: AnswerInput[]
): Promise<GradeOutcome> {
    const quiz: QuizRecord = (await dFetch(`/items/quiz/${quizId}`))?.data;
    if (!quiz) {
        return { ok: false, status: 404, error: "Quiz not found" };
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

    const gradedAnswers: GradedAnswerRow[] = answers.map((a) => {
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
                answerGivenText = picked ? picked.option_text ?? "[image]" : null;

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

    // All-or-nothing per question: a question scores 1 only if every one of its
    // answer rows is correct (fill-in-the-blank writes one row per blank).
    const questionAllCorrect = new Map<number, boolean>();
    for (const row of gradedAnswers) {
        const prior = questionAllCorrect.get(row.question_id);
        questionAllCorrect.set(row.question_id, (prior ?? true) && row.is_correct);
    }
    let score = 0;
    for (const allCorrect of questionAllCorrect.values()) {
        if (allCorrect) score += 1;
    }

    const numberOfQuestionsSnapshot = quiz.number_of_questions;
    const passThresholdSnapshot = quiz.pass_threshold_value;
    const percentageScore = Math.round((score / numberOfQuestionsSnapshot) * 10000) / 100;
    const passed = percentageScore >= passThresholdSnapshot;

    return {
        ok: true,
        gradedAnswers,
        score,
        percentageScore,
        passed,
        numberOfQuestionsSnapshot,
        passThresholdSnapshot,
    };
}

/**
 * Writes the `quiz_attempt` row and its `quiz_attempt_answer` rows (one batch
 * insert, preserving answer order). Returns the created attempt record.
 */
export async function persistGradedAttempt(params: {
    quizId: number;
    applicantId: number;
    administeredBy: number | null;
    startedAt: string | null;
    grade: GradeResult;
    // Set on the application-form continuity flow so the attempt is tied to the
    // specific application, not just the person. Null on the HR-desktop path.
    applicationId?: number | null;
}) {
    const { quizId, applicantId, administeredBy, startedAt, grade, applicationId } = params;

    const createdAttempt = await dFetch(`/items/quiz_attempt`, {
        method: "POST",
        body: JSON.stringify({
            quiz_id: quizId,
            applicant_id: applicantId,
            application_id: applicationId ?? null,
            administered_by: administeredBy,
            number_of_questions_snapshot: grade.numberOfQuestionsSnapshot,
            pass_threshold_value_snapshot: grade.passThresholdSnapshot,
            score: grade.score,
            percentage_score: grade.percentageScore,
            passed: grade.passed,
            started_at: startedAt || null,
            completed_at: new Date().toISOString(),
        }),
    });

    const attemptId = createdAttempt?.data?.id;
    if (attemptId) {
        await dFetch(`/items/quiz_attempt_answer`, {
            method: "POST",
            body: JSON.stringify(
                grade.gradedAnswers.map((ans) => ({ attempt_id: attemptId, ...ans }))
            ),
        });
    }

    return createdAttempt?.data;
}
