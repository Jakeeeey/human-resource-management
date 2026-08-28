// ============================================================================
// Quiz File Management — File Management (Question Pool) — Type Definitions
// ============================================================================

export type QuestionType =
    | "true_false"
    | "multiple_choice"
    | "identification"
    | "fill_in_the_blank";

export interface QuizQuestionOption {
    id: number;
    question_id: number;
    option_text: string | null;
    option_image: string | null;
    is_correct: boolean;
    sort: number | null;
}

export interface QuizQuestion {
    id: number;
    question_type: QuestionType;
    question_text: string;
    category: string | null;
    question_image: string | null;
    is_active: boolean;
    sort: number | null;
    created_at: string;
}

export interface QuizQuestionWithOptions extends QuizQuestion {
    // Choice rows (True/False, Multiple Choice) OR, for Identification/Fill
    // in the Blank, every accepted-answer row flattened across all blanks --
    // kept for the list view's "Options" count column. Editing a text-based
    // question uses expectedAnswersByBlank instead, which preserves the
    // grouping a flat list would lose.
    options: QuizQuestionOption[];
    expectedAnswersByBlank: string[][];
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface FileManagementFilters {
    search: string;
    questionType: QuestionType | null;
    category: string | null;
    includeInactive: boolean;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface QuizQuestionOptionFormData {
    option_text: string;
    option_image: string | null;
    is_correct: boolean;
}

// One entry per blank (always length 1 for Identification); `answers` holds
// every accepted synonym for that one blank, e.g. ["Manila", "City of Manila"].
export interface ExpectedAnswerBlankFormData {
    answers: string[];
}

export interface QuizQuestionFormData {
    question_type: QuestionType;
    question_text: string;
    category: string | null;
    question_image: string | null;
    options: QuizQuestionOptionFormData[];
    expectedAnswers: ExpectedAnswerBlankFormData[];
}
