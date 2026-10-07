import { z } from "zod";

// onboarding-task.schema.ts — Zod source of truth for the post-hire task
// catalog + per-employee tasks (todo 1 of onboarding-hub-replan), mirroring
// the LIVE Directus tables EXACTLY (probed `GET /fields/<collection>` on
// 2026-09-10):
//
//   onboarding_task_template — catalog seeded once (documents/orientation/
//                              training/equipment phases); UNIQUE code
//   onboarding_task          — materialized per employee `user_id` on hire
//                              (FK -> user.user_id, signed INT)
//
// `owner_role` is the SAME vocabulary on both tables (hr|department|hiree|
// system) — exported once and reused. `phase` is a plain varchar (do NOT
// invent a phase enum here). `status` is the stored snake_case enum; there
// is no other task-state vocabulary. Audit columns are app-written and
// nullable (zero DB defaults).

export const ONBOARDING_OWNER_ROLE = [
  "hr",
  "department",
  "hiree",
  "system",
] as const;

export type OnboardingOwnerRole = (typeof ONBOARDING_OWNER_ROLE)[number];

export const OnboardingOwnerRoleSchema = z.enum(ONBOARDING_OWNER_ROLE);

export const ONBOARDING_TASK_STATUS = [
  "pending",
  "in_progress",
  "done",
  "blocked",
  "na",
] as const;

export type OnboardingTaskStatus = (typeof ONBOARDING_TASK_STATUS)[number];

export const OnboardingTaskStatusSchema = z.enum(ONBOARDING_TASK_STATUS);

// The `tinyint(1)` columns (`onboarding_task_template.is_required`) are
// reported by `/fields` as `type=boolean` but SERIALIZED by the live Directus
// API as `0 | 1` (probed live 2026-09-10) — normalize at the boundary so the
// rest of the app only ever sees a real boolean. STRICT on purpose: a null
// `is_required` must be rejected, never silently coerced to `false`.
const OnboardingFlagSchema = z
  .union([z.boolean(), z.number().int().min(0).max(1)])
  .transform((value) => value === true || value === 1);

// `is_active` is TOLERANT — and only for `is_active` (never shared with
// `is_required`): legacy rows may serialize it as `null` or omit it, and
// null/absent means "active". Normalizes to a real boolean without throwing.
const ActiveFlagSchema = z
  .union([z.boolean(), z.number().int().min(0).max(1)])
  .nullish()
  .transform((value) => value !== false && value !== 0);

export const OnboardingTaskTemplateSchema = z.object({
  id: z.number().int().positive(),
  code: z.string(),
  title: z.string(),
  phase: z.string(),
  owner_role: OnboardingOwnerRoleSchema,
  is_required: OnboardingFlagSchema,
  sort_order: z.number().int(),
  is_active: ActiveFlagSchema,
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type OnboardingTaskTemplate = z.infer<
  typeof OnboardingTaskTemplateSchema
>;

export const OnboardingTaskSchema = z.object({
  id: z.number().int().positive(),
  user_id: z.number().int().positive(), // user.user_id is signed INT — never unsigned here
  template_id: z.number().int().positive().nullable(),
  owner_role: OnboardingOwnerRoleSchema,
  owner_user_id: z.number().int().positive().nullable(),
  status: OnboardingTaskStatusSchema,
  due_date: z.string().nullable(), // date | nullable — YYYY-MM-DD
  completed_by: z.number().int().positive().nullable(),
  completed_at: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type OnboardingTask = z.infer<typeof OnboardingTaskSchema>;
