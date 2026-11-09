export type AssessmentStatus = "draft" | "active" | "archived";
export type PassThresholdType = "percentage";

export interface Assessment {
    id: number;
    name: string;
    description: string | null;
    status: AssessmentStatus;
    pass_threshold_type: PassThresholdType;
    pass_threshold_value: number;
    time_limit_enabled: boolean;
    time_limit_minutes: number | null;
    number_of_questions: number;
    shuffle_questions: boolean;
    shuffle_answers: boolean;
    category_filter: string[];
    is_applicant_quiz: boolean;
    created_at: string;
}

export interface Applicant {
    id: number;
    full_name: string;
    position_applied_for: string | null;
    created_at: string;
}

export interface AssessmentManagementFilters {
    search: string;
    status: AssessmentStatus | null;
}

export interface AssessmentFormData {
    name: string;
    description: string;
    status: AssessmentStatus;
    pass_threshold_type: PassThresholdType;
    pass_threshold_value: number;
    time_limit_enabled: boolean;
    time_limit_minutes: number | null;
    number_of_questions: number;
    shuffle_questions: boolean;
    shuffle_answers: boolean;
    category_filter: string[];
    is_applicant_quiz: boolean;
}
