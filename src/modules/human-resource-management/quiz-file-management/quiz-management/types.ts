// ============================================================================
// Quiz File Management — Quiz Management — Type Definitions
// ============================================================================

export type QuizStatus = "draft" | "active" | "archived";
export type PassThresholdType = "percentage";

export interface Quiz {
    id: number;
    name: string;
    description: string | null;
    status: QuizStatus;
    pass_threshold_type: PassThresholdType;
    pass_threshold_value: number;
    time_limit_enabled: boolean;
    time_limit_minutes: number | null;
    number_of_questions: number;
    shuffle_questions: boolean;
    shuffle_answers: boolean;
    // Empty array = draw from every active category (no restriction).
    category_filter: string[];
    created_at: string;
}

// ============================================================================
// APPLICANT INTAKE TYPES
// ============================================================================

export interface Applicant {
    id: number;
    full_name: string;
    position_applied_for: string | null;
    created_at: string;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface QuizManagementFilters {
    search: string;
    status: QuizStatus | null;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface QuizFormData {
    name: string;
    description: string;
    status: QuizStatus;
    pass_threshold_type: PassThresholdType;
    pass_threshold_value: number;
    time_limit_enabled: boolean;
    time_limit_minutes: number | null;
    number_of_questions: number;
    shuffle_questions: boolean;
    shuffle_answers: boolean;
    category_filter: string[];
}
