import { z } from "zod";

// training-taking.schema.ts — Zod source of truth for Todo 12 (training taking).
//
// Mirrors the live `training_assignments` collection (re-keyed to the
// employee): id + user_id (assignee = the employee's `user.user_id`) +
// quiz_id + application_id bridge (nullable, never spoofed) + due +
// opened_at + status (assigned|in_progress|completed) + completed_ref + four
// nullable app-written audit columns (zero DB defaults). The path has no
// profile scope and never reads the retired profile table.
//
// Principal rule (plan §12): every taking mutation carries an employee
// principal (`actor: { user_id, role }`). The schema has NO `applicant_id`
// field anywhere — the taker is never applicant-shaped by construction. The
// engine `quiz_attempt` row (persisted server-side on submit) resolves its
// applicant through the REAL application chain
// (`assignment.application_id -> application.applicant_id`) or the submit is
// refused with reason — applicant ids are never accepted from the client.

export const TRAINING_TAKING_ROLES = ["hiree", "hr"] as const;

export type TrainingTakingRole = (typeof TRAINING_TAKING_ROLES)[number];

export const TrainingActorSchema = z
  .object({
    user_id: z.number().int().positive(),
    role: z.enum(TRAINING_TAKING_ROLES),
  })
  .strict();

export type TrainingActor = z.infer<typeof TrainingActorSchema>;

export const TrainingAssignmentSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  quiz_id: z.number().int().positive(),
  application_id: z.number().int().positive().nullable(),
  due: z.string().nullable(),
  opened_at: z.string().nullable(),
  status: z.enum(["assigned", "in_progress", "completed"]),
  completed_ref: z.number().int().nullable(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type TrainingTakingAssignment = z.infer<typeof TrainingAssignmentSchema>;

// POST body (HR): assigns a quiz to a hire (`user_id` = the employee's
// `user.user_id`). `due` is an optional deadline (overdue stays a DERIVED
// flag — never a stored state). `application_id` is an optional explicit HR
// link to the engine's application chain; when absent it stays null — never
// resolved from a profile.
export const CreateTrainingAssignmentSchema = z
  .object({
    user_id: z.number().int().positive(),
    quiz_id: z.number().int().positive(),
    due: z.string().min(1).nullable().optional(),
    application_id: z.number().int().positive().nullable().optional(),
  })
  .strict();

export type CreateTrainingAssignmentInput = z.infer<
  typeof CreateTrainingAssignmentSchema
>;

// PATCH body: guarded single-step transition (assigned -> in_progress ->
// completed). Completing requires a `completed_ref` (the persisted engine
// attempt id) — enforced here AND by the adapter guard.
export const TransitionTrainingAssignmentSchema = z
  .object({
    actor: TrainingActorSchema,
    to: z.enum(["in_progress", "completed"]),
    completed_ref: z.number().int().positive().nullable().optional(),
    reason: z.string().min(1).max(500).nullable().optional(),
  })
  .strict()
  .refine((d) => d.to !== "completed" || d.completed_ref != null, {
    message: "Completing an assignment requires a completed attempt ref",
    path: ["completed_ref"],
  });

export type TransitionTrainingAssignmentInput = z.infer<
  typeof TransitionTrainingAssignmentSchema
>;

// POST start body: hiree-owned draw entry. The route asserts the actor owns
// the assignment (IDOR: mismatch -> 403) BEFORE reusing the existing
// auth-gated draw entry (`drawQuizQuestions`, the same function the
// `quiz-attempt/start` route calls).
export const StartTrainingAttemptSchema = z
  .object({
    actor: TrainingActorSchema,
  })
  .strict();

export type StartTrainingAttemptInput = z.infer<
  typeof StartTrainingAttemptSchema
>;

// One answer row, VERBATIM from the engine `AnswerInput` shape
// (grading.ts) — built client-side via the Todo 4 adapter's
// `buildSubmitPayloads`, never hand-shaped.
export const TrainingAnswerRowSchema = z
  .object({
    question_id: z.number().int().positive(),
    blank_index: z.number().int().nonnegative().optional(),
    answer_given_text: z.string().optional(),
    answer_given_choice_id: z.number().int().positive().nullable().optional(),
    presented_choice_ids: z.array(z.number().int().positive()).optional(),
  })
  .strict();

export type TrainingAnswerRow = z.infer<typeof TrainingAnswerRowSchema>;

// POST submit body: either a graded submit (`answers`, non-empty) or an
// explicit abandon (`abandon: true` + reason — the assignment stays
// `in_progress` WITH the reason, never auto-completed/failed; re-take opens
// a NEW engine attempt under the SAME assignment id).
export const SubmitTrainingAttemptSchema = z
  .object({
    actor: TrainingActorSchema,
    answers: z.array(TrainingAnswerRowSchema).min(1).optional(),
    started_at: z.string().min(1).nullable().optional(),
    abandon: z.boolean().optional(),
    reason: z.string().min(1).max(500).optional(),
  })
  .strict()
  .refine((d) => d.abandon === true || (d.answers && d.answers.length > 0), {
    message: "Provide a non-empty answers array, or abandon with a reason",
    path: ["answers"],
  });

export type SubmitTrainingAttemptInput = z.infer<
  typeof SubmitTrainingAttemptSchema
>;

export interface TrainingTakingResponse {
  success: boolean;
  data?: unknown;
  message?: string;
}
