import type { AnswerKeySnapshot, QuizAttemptAnswer } from "../types";

export const CHOICE_TYPES = new Set(["true_false", "multiple_choice"]);

export const QUESTION_TYPE_LABELS: Record<string, string> = {
    true_false: "True / False",
    multiple_choice: "Multiple Choice",
    identification: "Identification",
    fill_in_the_blank: "Fill in the Blank",
};

export function letterFor(index: number): string {
    return String.fromCharCode(65 + index);
}

export function norm(value: string | null | undefined): string {
    return (value ?? "").trim().toLowerCase();
}

export function formatPercentage(value: number | string): string {
    return `${parseFloat(String(value))}%`;
}

export function formatDateTime(value: string | null): string {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    } catch {
        return value;
    }
}

export function parseSnapshot(
    raw: AnswerKeySnapshot | string | null
): AnswerKeySnapshot | null {
    if (!raw) return null;
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw) as AnswerKeySnapshot;
        } catch {
            return null;
        }
    }
    return raw;
}

export interface QuestionGroup {
    questionId: number;
    questionText: string;
    questionType: string;
    rows: QuizAttemptAnswer[];
}

export function groupByQuestion(answers: QuizAttemptAnswer[]): QuestionGroup[] {
    const order: number[] = [];
    const byId = new Map<number, QuestionGroup>();
    for (const row of answers) {
        let group = byId.get(row.question_id);
        if (!group) {
            group = {
                questionId: row.question_id,
                questionText: row.question_text_snapshot,
                questionType: row.question_type,
                rows: [],
            };
            byId.set(row.question_id, group);
            order.push(row.question_id);
        }
        group.rows.push(row);
    }
    return order.map((id) => byId.get(id)!);
}

/** True when the attempt recorded any answer (choice or text) for this row. */
export function rowHasAnswer(row: QuizAttemptAnswer): boolean {
    if (CHOICE_TYPES.has(row.question_type)) {
        const snap = parseSnapshot(row.answer_key_snapshot);
        const givenChoiceId =
            (snap && snap.kind === "choice" ? snap.given_choice_id : null) ??
            row.answer_given_choice_id ??
            null;
        return givenChoiceId != null || (row.answer_given_text ?? "").trim() !== "";
    }
    return (row.answer_given_text ?? "").trim() !== "";
}
