import { z } from "zod";

// training-catalog.schema.ts — Zod source of truth for the "Onboarding Training
// Templates" catalog (per-department, on-site live training), mirroring the
// LIVE Directus tables EXACTLY:
//
//   onboarding_training_template — a per-department (or global) template; a
//                                  null `department_id` is the GLOBAL template
//                                  that applies to every department
//   onboarding_training_item     — one on-site training item inside a template
//
// Flag semantics are COPIED from `onboarding-task.schema.ts` (never shared, so
// the two contracts can drift independently if ever needed): `is_required` is
// STRICT — a null flag is rejected, never coerced to `false`; `is_active` is
// TOLERANT — null/absent means "active". The `tinyint(1)` columns are
// serialized by the live Directus API as `0 | 1`, normalized at this boundary.
// Audit columns are app-written and nullable (zero DB defaults).

const TrainingFlagSchema = z
  .union([z.boolean(), z.number().int().min(0).max(1)])
  .transform((value) => value === true || value === 1);

const TrainingActiveFlagSchema = z
  .union([z.boolean(), z.number().int().min(0).max(1)])
  .nullish()
  .transform((value) => value !== false && value !== 0);

export const TrainingTemplateSchema = z.object({
  id: z.number().int().positive(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  /** null = GLOBAL template (applies to every department). */
  department_id: z.number().int().positive().nullable(),
  is_active: TrainingActiveFlagSchema,
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type TrainingTemplate = z.infer<typeof TrainingTemplateSchema>;

export const TrainingItemSchema = z.object({
  id: z.number().int().positive(),
  template_id: z.number().int().positive(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  is_required: TrainingFlagSchema,
  sort_order: z.number().int(),
  is_active: TrainingActiveFlagSchema,
  created_at: z.string().nullable(),
  created_by: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.number().int().nullable(),
});

export type TrainingItem = z.infer<typeof TrainingItemSchema>;

export const CreateTrainingTemplateSchema = z
  .object({
    code: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1).max(255),
    description: z.string().nullable().optional(),
    department_id: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const UpdateTrainingTemplateSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    department_id: z.number().int().positive().nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

export const CreateTrainingItemSchema = z
  .object({
    code: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1).max(255),
    description: z.string().nullable().optional(),
    is_required: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
  })
  .strict();

export const UpdateTrainingItemSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    is_required: z.boolean().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
  })
  .strict();
