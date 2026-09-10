/**
 * Training-assignment contract + employee-principal adapter (Todo 4).
 *
 * Contract mirrors the live Directus `training_assignments` collection
 * (re-keyed to the employee `user_id`). No UI here; Todo 12 builds the
 * taking view on top of this adapter.
 *
 * Hard rules (from the plan, enforced by construction):
 * - Lifecycle is `assigned -> in_progress -> completed` ONLY. Overdue is a
 *   DERIVED flag (`isAssignmentOverdue`), never a stored state.
 * - Abandoned attempts stay `in_progress` with a reason; a retake opens a
 *   NEW `quiz_attempt` row under the SAME assignment id.
 * - Pass thresholds are INHERITED from the quiz definition via the real
 *   `gradeAnswers` result (`GradeResult.passThresholdSnapshot`) — this file
 *   never computes score, percentage, or pass/fail.
 * - The `application_id` bridge is an explicit HR manual link to the
 *   engine's application chain; when absent it stays `null` — applicant ids
 *   are never spoofed and never resolved from a profile.
 * - Draw/grade/history inputs are built VERBATIM from the existing engine
 *   shapes (`AnswerInput`, `SubmitAnswerPayload`, `TakingQuestion`,
 *   `QuizAttempt`). Grading is never re-implemented here.
 *
 * Quiz-engine files (`quiz-draw.ts`, `grading.ts`, quiz-attempt routes,
 * quiz-history) are READ-ONLY: this module only imports their TYPES
 * (`import type` — zero runtime coupling, zero edits).
 */

import type {
    AnswerInput,
    GradeResult,
} from "@/modules/human-resource-management/quiz-file-management/utils/grading";
import type { QuizAttempt } from "@/modules/human-resource-management/quiz-file-management/quiz-history/types";
import type {
    AnswersByQuestionId,
    SubmitAnswerPayload,
    TakingQuestion,
} from "@/modules/human-resource-management/quiz-file-management/quiz-taking/types";

// ---------------------------------------------------------------------------
// Contract (mirrors Directus `training_assignments`, keyed to the employee)
// ---------------------------------------------------------------------------

export const TRAINING_ASSIGNMENT_STATUSES = ["assigned", "in_progress", "completed"] as const;

export type TrainingAssignmentStatus = (typeof TRAINING_ASSIGNMENT_STATUSES)[number];

export interface TrainingAssignment {
    id: number;
    user_id: number;
    quiz_id: number;
    application_id: number | null;
    due: string | null;
    opened_at: string | null;
    status: TrainingAssignmentStatus;
    completed_ref: number | null;
    created_at: string | null;
    created_by: number | null;
    updated_at: string | null;
    updated_by: number | null;
}

/** Employee principal carried through the assignment flow (never applicant-shaped). */
export interface EmployeePrincipal {
    user_id: number;
}

// ---------------------------------------------------------------------------
// Lifecycle: assigned -> in_progress -> completed (forward-only, single-step)
// ---------------------------------------------------------------------------

const NEXT_STATUS: Record<TrainingAssignmentStatus, TrainingAssignmentStatus[]> = {
    assigned: ["in_progress"],
    in_progress: ["completed"],
    completed: [],
};

export function canTransition(from: TrainingAssignmentStatus, to: TrainingAssignmentStatus): boolean {
    return NEXT_STATUS[from].includes(to);
}

export type AssignmentTransition =
    | { ok: true; assignment: TrainingAssignment }
    | { ok: false; error: string };

/**
 * Guarded single-step transition. Completing requires a `completedRef`
 * (the persisted attempt id); `completed` is terminal. All other fields
 * pass through untouched.
 */
export function transitionAssignment(
    assignment: TrainingAssignment,
    to: TrainingAssignmentStatus,
    opts?: { completedRef?: number | null }
): AssignmentTransition {
    if (!canTransition(assignment.status, to)) {
        return {
            ok: false,
            error: `Illegal transition ${assignment.status} -> ${to}; allowed: assigned -> in_progress -> completed`,
        };
    }
    if (to === "completed" && (opts?.completedRef === undefined || opts.completedRef === null)) {
        return { ok: false, error: "Completing an assignment requires a completed attempt ref" };
    }
    return {
        ok: true,
        assignment: {
            ...assignment,
            status: to,
            completed_ref: to === "completed" ? (opts?.completedRef as number) : assignment.completed_ref,
        },
    };
}

// ---------------------------------------------------------------------------
// Overdue: DERIVED flag, never a stored state
// ---------------------------------------------------------------------------

/**
 * Derived overdue flag: a non-completed assignment whose `due` has passed.
 * `due === null` means no deadline (never overdue). Never persisted.
 */
export function isAssignmentOverdue(
    assignment: Pick<TrainingAssignment, "status" | "due">,
    nowIso: string = new Date().toISOString()
): boolean {
    if (assignment.status === "completed") return false;
    if (assignment.due === null) return false;
    return nowIso > assignment.due;
}

// ---------------------------------------------------------------------------
// Abandoned attempts + retakes
// ---------------------------------------------------------------------------

/**
 * Abandoned/expiry rule: the attempt stays `in_progress` WITH a reason —
 * it is never auto-completed, auto-failed, or moved to a pseudo-state.
 */
export function abandonedInProgress(reason: string): {
    status: Extract<TrainingAssignmentStatus, "in_progress">;
    reason: string;
} {
    return { status: "in_progress", reason };
}

/**
 * Retake target: a retake opens a NEW `quiz_attempt` row under the SAME
 * assignment id. Returns the verbatim inputs Todo 12's start call needs.
 */
export function describeRetakeTarget(assignment: Pick<TrainingAssignment, "id" | "quiz_id" | "application_id">): {
    assignment_id: number;
    quiz_id: number;
    application_id: number | null;
} {
    return {
        assignment_id: assignment.id,
        quiz_id: assignment.quiz_id,
        application_id: assignment.application_id,
    };
}

// ---------------------------------------------------------------------------
// Engine inputs, built VERBATIM from existing shapes
// ---------------------------------------------------------------------------

/**
 * Draw input: the quiz id passed STRAIGHT through to
 * `drawQuizQuestions(quizId: string | number)` (quiz-draw.ts:73).
 * No transform, no reinterpretation.
 */
export function buildDrawInput(assignment: Pick<TrainingAssignment, "quiz_id">): number {
    return assignment.quiz_id;
}

export type GradeInput =
    | { ok: true; quizId: number; answers: AnswerInput[] }
    | { ok: false; error: string };

/**
 * Grade input: `{ quizId, answers }` spread DIRECTLY into
 * `gradeAnswers(quizId: number, answers: AnswerInput[])` (grading.ts:80).
 * Answers pass through verbatim; only emptiness is rejected here.
 */
export function buildGradeInput(
    assignment: Pick<TrainingAssignment, "quiz_id">,
    answers: AnswerInput[]
): GradeInput {
    if (!Array.isArray(answers) || answers.length === 0) {
        return { ok: false, error: "A non-empty answers array is required for grading" };
    }
    return { ok: true, quizId: assignment.quiz_id, answers };
}

const CHOICE_TYPES = new Set(["true_false", "multiple_choice"]);

/**
 * Submit-payload builder, VERBATIM from
 * `QuizTakingModule.buildSubmitAnswers` (QuizTakingModule.tsx:25-47):
 * choice questions collapse to one `{ question_id, answer_given_choice_id,
 * presented_choice_ids }` row; text questions expand to one
 * `{ question_id, blank_index, answer_given_text }` row per blank.
 * Input-building only — scoring stays inside the untouched engine.
 */
export function buildSubmitPayloads(
    questions: TakingQuestion[],
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

// ---------------------------------------------------------------------------
// Completion outputs (display-safe scalars + history ref, never answers/keys)
// ---------------------------------------------------------------------------

/** Display-safe completion scalars, mirroring the taking-module done-screen rule. */
export interface AssignmentCompletionScalars {
    score: number;
    percentage_score: number;
    passed: boolean;
    number_of_questions_snapshot: number;
    pass_threshold_value_snapshot: number;
}

/**
 * Reads completion scalars STRAIGHT off the real `GradeResult` — thresholds
 * inherited from the quiz definition, never redefined here. Carries no
 * answers or answer keys (same rule as the taking-module done screen).
 */
export function buildCompletionScalars(grade: GradeResult): AssignmentCompletionScalars {
    return {
        score: grade.score,
        percentage_score: grade.percentageScore,
        passed: grade.passed,
        number_of_questions_snapshot: grade.numberOfQuestionsSnapshot,
        pass_threshold_value_snapshot: grade.passThresholdSnapshot,
    };
}

/**
 * History link: the completed attempt ref comes from the `QuizAttempt`
 * history shape (quiz-history/types.ts:12-27) — the assignment's
 * `completed_ref` points at that attempt row.
 */
export function buildCompletedRef(attempt: Pick<QuizAttempt, "id">): number {
    return attempt.id;
}
