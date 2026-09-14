import { z } from "zod";

// trainingTemplatesApi.schema.ts — HTTP-boundary contracts for the
// training-templates admin API. SERVER-ONLY: these are route-body shapes;
// never import this module from a client component.
//
// Every mutation body is `.strict()`: an unknown key answers 400 BEFORE any
// Directus read or write. `code` is immutable after create, so the update
// schemas reject it outright (strict → 400), and every update body is a
// NON-EMPTY partial — an empty patch is refused.
//
// The create schemas mirror `training-catalog.schema.ts` and add the optional
// `is_active` flag the API contract exposes (absent = the row is created
// active).

const CODE_SCHEMA = z.string().trim().min(1).max(64);
const TITLE_SCHEMA = z.string().trim().min(1).max(255);
const DESCRIPTION_SCHEMA = z.string().nullable();
/** null = GLOBAL template (applies to every department). */
const DEPARTMENT_ID_SCHEMA = z.number().int().positive().nullable();

const nonEmptyPatch = (data: Record<string, unknown>): boolean =>
  Object.keys(data).length > 0;

// ---------------------------------------------------------------------------
// onboarding_training_template
// ---------------------------------------------------------------------------

export const CreateTrainingTemplateBodySchema = z
  .object({
    code: CODE_SCHEMA,
    title: TITLE_SCHEMA,
    description: DESCRIPTION_SCHEMA.optional(),
    department_id: DEPARTMENT_ID_SCHEMA.optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

export type CreateTrainingTemplateBody = z.infer<
  typeof CreateTrainingTemplateBodySchema
>;

export const UpdateTrainingTemplateBodySchema = z
  .object({
    title: TITLE_SCHEMA.optional(),
    description: DESCRIPTION_SCHEMA.optional(),
    department_id: DEPARTMENT_ID_SCHEMA.optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine(nonEmptyPatch, { message: "At least one field must be provided" });

export type UpdateTrainingTemplateBody = z.infer<
  typeof UpdateTrainingTemplateBodySchema
>;

// ---------------------------------------------------------------------------
// onboarding_training_item
// ---------------------------------------------------------------------------

export const CreateTrainingItemBodySchema = z
  .object({
    code: CODE_SCHEMA,
    title: TITLE_SCHEMA,
    description: DESCRIPTION_SCHEMA.optional(),
    is_required: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

export type CreateTrainingItemBody = z.infer<
  typeof CreateTrainingItemBodySchema
>;

export const UpdateTrainingItemBodySchema = z
  .object({
    title: TITLE_SCHEMA.optional(),
    description: DESCRIPTION_SCHEMA.optional(),
    is_required: z.boolean().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(nonEmptyPatch, { message: "At least one field must be provided" });

export type UpdateTrainingItemBody = z.infer<
  typeof UpdateTrainingItemBodySchema
>;
