import { z } from "zod";

import { OnboardingOwnerRoleSchema } from "@/modules/human-resource-management/onboarding/types/onboarding-task.schema";

// hire-roster.schema.ts — HTTP contract for the onboarding hub roster (todo 27).
//
// The roster is a DERIVED, read-only view over the employee-keyed task engine:
// one row per employee that owns `onboarding_task` rows (the post-hire roster —
// the engine materializes tasks at hire, so a hire IS a user with tasks). The
// row carries the six hub columns the plan names: hire, status/phase, next
// action, owner, due, blockers — no profile vocabulary and no stage-as-tab.
//
// `status` is a DERIVED roll-up over the REQUIRED tasks (done/na satisfied):
//   complete     -> at least one required task AND every required task done/na
//   blocked      -> an open required task is `blocked`
//   in_progress  -> some progress, no hard blocker
//   not_started  -> nothing satisfied yet
// The empty-set guard mirrors `isCompletionReady`: zero required tasks is NEVER
// `complete` (a missing task set must not read as success).

export const HIRE_ROSTER_STATUS = [
  "not_started",
  "in_progress",
  "blocked",
  "complete",
] as const;

export type HireRosterStatus = (typeof HIRE_ROSTER_STATUS)[number];

export const HireRosterStatusSchema = z.enum(HIRE_ROSTER_STATUS);

/** The single actionable task surfaced in the "next action" column. */
export const HireRosterActionSchema = z.object({
  taskId: z.number().int().positive(),
  label: z.string(),
  ownerRole: OnboardingOwnerRoleSchema,
  dueDate: z.string().nullable(),
  /** True when the only remaining work is blocked (next action is a blocker). */
  blocked: z.boolean(),
});

export type HireRosterAction = z.infer<typeof HireRosterActionSchema>;

export const HireRosterBlockerSchema = z.object({
  taskId: z.number().int().positive(),
  label: z.string(),
  notes: z.string().nullable(),
});

export type HireRosterBlocker = z.infer<typeof HireRosterBlockerSchema>;

/** Per-phase required-task progress for the detail pane. */
export const HireRosterPhaseProgressSchema = z.object({
  phase: z.string(),
  done: z.number().int().min(0),
  total: z.number().int().min(0),
});

export type HireRosterPhaseProgress = z.infer<
  typeof HireRosterPhaseProgressSchema
>;

export const HireRosterRowSchema = z.object({
  userId: z.number().int().positive(),
  name: z.string(),
  status: HireRosterStatusSchema,
  /** Phase of the first open required task (null when complete/none open). */
  phase: z.string().nullable(),
  /** Distinct phases this hire has required tasks in (filter vocabulary). */
  phases: z.array(z.string()),
  phaseProgress: z.array(HireRosterPhaseProgressSchema),
  requiredDone: z.number().int().min(0),
  requiredTotal: z.number().int().min(0),
  nextAction: HireRosterActionSchema.nullable(),
  ownerRole: OnboardingOwnerRoleSchema.nullable(),
  /** Earliest open required-task due date (YYYY-MM-DD), else null. */
  dueDate: z.string().nullable(),
  blockers: z.array(HireRosterBlockerSchema),
});

export type HireRosterRow = z.infer<typeof HireRosterRowSchema>;

/** GET /api/hrm/onboarding/hire-roster envelope. */
export const HireRosterResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.object({ hires: z.array(HireRosterRowSchema) }).optional(),
});

export type HireRosterResponse = z.infer<typeof HireRosterResponseSchema>;
