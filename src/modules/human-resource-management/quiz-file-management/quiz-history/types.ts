// ============================================================================
// Quiz File Management — Quiz History — Type Definitions
// ============================================================================

export interface QuizSummary {
    id: number;
    name: string;
}

export interface ApplicantSummary {
    id: number;
    full_name: string;
    position_applied_for: string | null;
}

export interface QuizAttempt {
    id: number;
    quiz_id: number;
    applicant_id: number;
    administered_by: number | null;
    number_of_questions_snapshot: number;
    pass_threshold_value_snapshot: number;
    score: number;
    percentage_score: number;
    passed: boolean;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    quiz: QuizSummary | null;
    applicant: ApplicantSummary | null;
}

export interface AnswerKeyOption {
    id?: number; // present on newer (choice-by-id) snapshots; absent on older text-keyed ones
    text: string | null;
    image?: string | null;
    is_correct: boolean;
}

// Frozen answer key captured per answer row when the attempt was graded.
// `choice` covers true_false / multiple_choice; `text` covers identification
// and one entry per blank for fill_in_the_blank. Choice options are in the order
// the applicant saw them.
export type AnswerKeySnapshot =
    | { kind: "choice"; options: AnswerKeyOption[]; given_choice_id?: number | null }
    | { kind: "text"; blank_index: number; accepted: string[] };

export interface QuizAttemptAnswer {
    id: number;
    attempt_id: number;
    question_id: number;
    question_text_snapshot: string;
    question_type: string;
    answer_given_text: string | null;
    answer_given_choice_id: number | null;
    is_correct: boolean;
    // Directus may hand a real MySQL JSON column back either already parsed or
    // as a raw string -- the dialog normalises both. Null for attempts graded
    // before this column existed.
    answer_key_snapshot: AnswerKeySnapshot | string | null;
    created_at: string;
}

export interface QuizAttemptDetail {
    attempt: QuizAttempt;
    answers: QuizAttemptAnswer[];
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface QuizHistoryFilters {
    search: string;
    quizId: number | null;
    passed: boolean | null;
}
