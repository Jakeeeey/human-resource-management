export type QuestionType =
    | "true_false"
    | "multiple_choice"
    | "identification"
    | "fill_in_the_blank";

export interface AssessmentQuestionOption {
    id: number;
    question_id: number;
    option_text: string | null;
    option_image: string | null;
    is_correct: boolean;
    sort: number | null;
}

export interface AssessmentQuestion {
    id: number;
    question_type: QuestionType;
    question_text: string;
    category: string | null;
    question_image: string | null;
    is_active: boolean;
    sort: number | null;
    created_at: string;
}

export interface AssessmentQuestionWithOptions extends AssessmentQuestion {
    options: AssessmentQuestionOption[];
    expectedAnswersByBlank: string[][];
}

export interface FileManagementFilters {
    search: string;
    questionType: QuestionType | null;
    category: string | null;
    includeInactive: boolean;
}

export interface AssessmentQuestionOptionFormData {
    option_text: string;
    option_image: string | null;
    is_correct: boolean;
}

export interface ExpectedAnswerBlankFormData {
    answers: string[];
}

export interface AssessmentQuestionFormData {
    question_type: QuestionType;
    question_text: string;
    category: string | null;
    question_image: string | null;
    options: AssessmentQuestionOptionFormData[];
    expectedAnswers: ExpectedAnswerBlankFormData[];
}
