import type {
    AnswersByQuestionId,
    StartQuizResponse,
    SubmitAnswerPayload,
    TakingQuestion,
} from "../types";

export const CHOICE_TYPES = new Set(["true_false", "multiple_choice"]);

/** Maps local answer state onto the POST payload expected by the grade route. */
export function buildSubmitAnswers(
    questions: StartQuizResponse["questions"],
    answers: AnswersByQuestionId
): SubmitAnswerPayload[] {
    const payload: SubmitAnswerPayload[] = [];
    for (const q of questions) {
        const given = answers[q.id] || [];
        if (CHOICE_TYPES.has(q.question_type)) {
            const picked = given[0] ? Number(given[0]) : null;
            payload.push({
                question_id: q.id,
                answer_given_choice_id: picked != null && !Number.isNaN(picked) ? picked : null,
                presented_choice_ids: q.choices.map((c) => c.id),
            });
            continue;
        }
        const blankCount = q.blank_count || 1;
        for (let i = 0; i < blankCount; i++) {
            payload.push({ question_id: q.id, blank_index: i, answer_given_text: given[i] || "" });
        }
    }
    return payload;
}

/** A fill-in-the-blank counts as answered only when every blank has text. */
export function isQuestionAnswered(
    question: TakingQuestion,
    given: string[] | undefined
): boolean {
    const values = given || [];
    if (CHOICE_TYPES.has(question.question_type) || question.question_type === "identification") {
        return (values[0] ?? "").trim() !== "";
    }
    const blankCount = question.blank_count || 1;
    for (let i = 0; i < blankCount; i++) {
        if ((values[i] ?? "").trim() === "") return false;
    }
    return true;
}
