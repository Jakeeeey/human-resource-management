import { z } from "zod";

import { DOC_SLOT_KEY_PATTERN } from "../../../employee-portal/server/documentSlotIo";
import { EQUIPMENT_ITEM_KEY_PATTERN } from "../../equipment/server/equipmentItemIo";
import { EquipmentIssuerSchema } from "../../equipment/types/equipment-issue.schema";
import { OrientationTrackSchema } from "../../orientation/types/orientation.schema";
import { OnboardingOwnerRoleSchema } from "../../types/onboarding-task.schema";

// requirements-api.schema.ts — HTTP-boundary contracts for the requirements
// CRUD API (todo 13 of onboarding-requirements-config). SERVER-ONLY: these are
// route-body shapes; never import this module from a client component.
//
// Every mutation body is `.strict()`: an unknown key answers 400 BEFORE any
// Directus read or write (the plan's unknown-keys pin). Natural keys are
// IMMUTABLE after create — `doc_key`, `item_key`, `code` are referenced by
// file markers / issue doc_refs / derived task templates, so the update
// schemas reject them outright (strict → 400).
//
// The reorder body is the PINNED contract, identical for all four catalogs:
//   PATCH /api/hrm/onboarding/requirements/<catalog>/reorder
//   { order: [{ id: number, sort_order: number }] }

export const RequirementsOrderEntrySchema = z
  .object({
    id: z.number().int().positive(),
    sort_order: z.number().int().min(0),
  })
  .strict();

export const RequirementsReorderBodySchema = z
  .object({
    order: z.array(RequirementsOrderEntrySchema).min(1),
  })
  .strict();

export type RequirementsReorderBody = z.infer<
  typeof RequirementsReorderBodySchema
>;

const TITLE_SCHEMA = z.string().min(1).max(255);

const nonEmptyPatch = (data: Record<string, unknown>): boolean =>
  Object.keys(data).length > 0;

// ---------------------------------------------------------------------------
// documents — onboarding_document_slot
// ---------------------------------------------------------------------------

export const CreateDocumentSlotBodySchema = z
  .object({
    doc_key: z.string().regex(DOC_SLOT_KEY_PATTERN),
    title: TITLE_SCHEMA,
    is_required: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
  })
  .strict();

export type CreateDocumentSlotBody = z.infer<
  typeof CreateDocumentSlotBodySchema
>;

export const UpdateDocumentSlotBodySchema = z
  .object({
    title: TITLE_SCHEMA.optional(),
    is_required: z.boolean().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(nonEmptyPatch, { message: "At least one field must be provided" });

export type UpdateDocumentSlotBody = z.infer<
  typeof UpdateDocumentSlotBodySchema
>;

// ---------------------------------------------------------------------------
// orientation — orientation_topic
// ---------------------------------------------------------------------------

/** Topic codes are the existing slugs (`company-background`, …). */
export const ORIENTATION_TOPIC_CODE_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

export const CreateOrientationTopicBodySchema = z
  .object({
    code: z.string().regex(ORIENTATION_TOPIC_CODE_PATTERN).optional(),
    title: TITLE_SCHEMA,
    track: OrientationTrackSchema,
    is_required: z.boolean().optional(),
  })
  .strict();

export type CreateOrientationTopicBody = z.infer<
  typeof CreateOrientationTopicBodySchema
>;

export const UpdateOrientationTopicBodySchema = z
  .object({
    title: TITLE_SCHEMA.optional(),
    is_required: z.boolean().optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine(nonEmptyPatch, { message: "At least one field must be provided" });

export type UpdateOrientationTopicBody = z.infer<
  typeof UpdateOrientationTopicBodySchema
>;

// ---------------------------------------------------------------------------
// equipment — onboarding_equipment_item
// ---------------------------------------------------------------------------

export const CreateEquipmentItemBodySchema = z
  .object({
    item_key: z.string().regex(EQUIPMENT_ITEM_KEY_PATTERN),
    label: TITLE_SCHEMA,
    issuer: EquipmentIssuerSchema,
    is_required: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
  })
  .strict();

export type CreateEquipmentItemBody = z.infer<
  typeof CreateEquipmentItemBodySchema
>;

export const UpdateEquipmentItemBodySchema = z
  .object({
    label: TITLE_SCHEMA.optional(),
    issuer: EquipmentIssuerSchema.optional(),
    is_required: z.boolean().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(nonEmptyPatch, { message: "At least one field must be provided" });

export type UpdateEquipmentItemBody = z.infer<
  typeof UpdateEquipmentItemBodySchema
>;

// ---------------------------------------------------------------------------
// task templates — onboarding_task_template (documents / training / equipment)
// ---------------------------------------------------------------------------

// Orientation-phase templates are DERIVED from the orientation topic catalog
// (todo 2) and are edited through the orientation section — the requirements
// task-template catalog manages the other three phases only.
export const REQUIREMENTS_TASK_PHASES = [
  "documents",
  "training",
  "equipment",
] as const;

export type RequirementsTaskPhase = (typeof REQUIREMENTS_TASK_PHASES)[number];

export const RequirementsTaskPhaseSchema = z.enum(REQUIREMENTS_TASK_PHASES);

export function isManagedTemplatePhase(
  phase: string
): phase is RequirementsTaskPhase {
  return (REQUIREMENTS_TASK_PHASES as readonly string[]).includes(phase);
}

/** Template codes are the seeded snake_case keys (`documents_submitted`, …). */
export const TEMPLATE_CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export const CreateTaskTemplateBodySchema = z
  .object({
    code: z.string().regex(TEMPLATE_CODE_PATTERN),
    title: TITLE_SCHEMA,
    phase: RequirementsTaskPhaseSchema,
    owner_role: OnboardingOwnerRoleSchema,
    is_required: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
  })
  .strict();

export type CreateTaskTemplateBody = z.infer<
  typeof CreateTaskTemplateBodySchema
>;

export const UpdateTaskTemplateBodySchema = z
  .object({
    title: TITLE_SCHEMA.optional(),
    phase: RequirementsTaskPhaseSchema.optional(),
    owner_role: OnboardingOwnerRoleSchema.optional(),
    is_required: z.boolean().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(nonEmptyPatch, { message: "At least one field must be provided" });

export type UpdateTaskTemplateBody = z.infer<
  typeof UpdateTaskTemplateBodySchema
>;
