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
    options: QuizQuestionOption[];
    expectedAnswersByBlank: string[][];
}

export interface FileManagementFilters {
    search: string;
    questionType: QuestionType | null;
    category: string | null;
    includeInactive: boolean;
}

export interface QuizQuestionOptionFormData {
    option_text: string;
    option_image: string | null;
    is_correct: boolean;
}

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
