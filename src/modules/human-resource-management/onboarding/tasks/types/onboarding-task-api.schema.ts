import { z } from "zod";

import {
  OnboardingOwnerRoleSchema,
  OnboardingTaskStatusSchema,
} from "../../types/onboarding-task.schema";

// onboarding-task-api.schema.ts — WRITE/QUERY contracts for the employee-keyed
// task API (todo 19). Record shapes come from the todo-1
// `../../types/onboarding-task.schema` (the live Directus mirror); these are
// the HTTP-boundary shapes:
//
//   POST  /api/hrm/onboarding/onboarding-task               -> materialize body
//   GET   /api/hrm/onboarding/onboarding-task               -> list query
//   PATCH /api/hrm/onboarding/onboarding-task/[id]          -> update body
//   POST  /api/hrm/onboarding/onboarding-task/[id]/complete -> complete body
//   POST  /api/hrm/onboarding/onboarding-task-template/seed -> seed body
//
// `.strict()` everywhere: unknown keys answer 400 BEFORE any Directus write.
// `owner_role` / `status` reuse the todo-1 enums — there is no second status
// vocabulary (the 11 legacy statuses are NOT accepted).

export const MaterializeOnboardingTasksSchema = z
  .object({
    user_id: z.number().int().positive(),
  })
  .strict();

export type MaterializeOnboardingTasksInput = z.infer<
  typeof MaterializeOnboardingTasksSchema
>;

export const OnboardingTaskListQuerySchema = z
  .object({
    user_id: z.coerce.number().int().positive().optional(),
    status: OnboardingTaskStatusSchema.optional(),
    owner_role: OnboardingOwnerRoleSchema.optional(),
  })
  .strict();

export type OnboardingTaskListQuery = z.infer<
  typeof OnboardingTaskListQuerySchema
>;

const DUE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const OnboardingTaskUpdateSchema = z
  .object({
    status: OnboardingTaskStatusSchema.optional(),
    notes: z.string().max(65535).nullable().optional(),
    due_date: z
      .string()
      .regex(DUE_DATE_REGEX, "due_date must be YYYY-MM-DD")
      .nullable()
      .optional(),
    owner_user_id: z.number().int().positive().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type OnboardingTaskUpdate = z.infer<typeof OnboardingTaskUpdateSchema>;

/** Complete takes an EMPTY strict body — the actor comes from the session. */
export const OnboardingTaskCompleteSchema = z.object({}).strict();

/** Seed takes an EMPTY strict body — the catalog is code-owned. */
export const SeedOnboardingTaskTemplatesSchema = z.object({}).strict();
