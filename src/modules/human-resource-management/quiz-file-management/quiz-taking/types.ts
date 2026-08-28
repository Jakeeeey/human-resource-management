// ============================================================================
// Quiz File Management — Quiz Taking — Type Definitions
// ============================================================================

export type TakingQuestionType =
    | "true_false"
    | "multiple_choice"
    | "identification"
    | "fill_in_the_blank";

export interface TakingChoice {
    id: number;
    option_text: string | null;
    option_image: string | null;
}

export interface TakingQuestion {
    id: number;
    question_type: TakingQuestionType;
    question_text: string;
    question_image: string | null;
    choices: TakingChoice[];
    blank_count: number;
}

export interface TakingQuiz {
    id: number;
    name: string;
    number_of_questions: number;
    pass_threshold_value: number;
    time_limit_enabled: boolean;
    time_limit_minutes: number | null;
}

export interface StartQuizResponse {
    quiz: TakingQuiz;
    questions: TakingQuestion[];
}

export type AnswersByQuestionId = Record<number, string[]>;

// Choice questions submit the picked choice id plus the on-screen order (so the
// breakdown's A/B/C/D labels match what the applicant saw). Text questions submit
// the typed text per blank.
export type SubmitAnswerPayload =
    | {
          question_id: number;
          answer_given_choice_id: number | null;
          presented_choice_ids: number[];
      }
    | {
          question_id: number;
          blank_index: number;
          answer_given_text: string;
      };

export interface AttemptResultSummary {
    id: number;
    score: number;
    percentage_score: number;
    passed: boolean;
}
