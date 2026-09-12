import type { OnboardingDocumentSlot } from "../../../employee-portal/server/documentSlotIo";
import type { OnboardingEquipmentItem } from "../../equipment/server/equipmentItemIo";
import type { EquipmentIssuer } from "../../equipment/types/equipment-issue.schema";
import type { OrientationTopicRow } from "../../orientation/server/orientationTopicIo";
import type { OrientationTrack } from "../../orientation/types/orientation.schema";
import type {
  OnboardingOwnerRole,
  OnboardingTaskTemplate,
} from "../../types/onboarding-task.schema";

// requirements-catalog.schema.ts — CLIENT-SAFE contracts for the requirements
// admin catalog (todo 15 of onboarding-requirements-config).
//
// This module carries TYPES ONLY (no zod, no runtime values) and imports every
// row shape with `import type`, so nothing here reaches the browser bundle.
// The server-side request-body schemas stay in `requirements-api.schema.ts`
// (server-only) — the input interfaces below MIRROR those `.strict()` shapes so
// the client can build a request without importing the server module.
//
// If a server-side create/update body changes, change the matching interface
// here too (the route will answer 400 on an unknown/missing key either way).

// ---------------------------------------------------------------------------
// Row shapes — the GET `<catalog>` envelope `{ success, data: Row[] }`
// ---------------------------------------------------------------------------

/** `onboarding_document_slot` row (documents catalog). */
export type DocumentSlotRow = OnboardingDocumentSlot;
/** `orientation_topic` row (orientation catalog). */
export type OrientationTopicCatalogRow = OrientationTopicRow;
/** `onboarding_equipment_item` row (equipment catalog). */
export type EquipmentItemRow = OnboardingEquipmentItem;
/** `onboarding_task_template` row (documents / training / equipment phases). */
export type TaskTemplateRow = OnboardingTaskTemplate;

// ---------------------------------------------------------------------------
// Catalog slugs — the `/api/hrm/onboarding/requirements/<slug>` route segment
// ---------------------------------------------------------------------------

export const REQUIREMENTS_CATALOGS = [
  "documents",
  "orientation",
  "equipment",
  "task-templates",
] as const;

export type RequirementsCatalogKey = (typeof REQUIREMENTS_CATALOGS)[number];

/** `?all=1` includes deactivated rows; `?phase=` narrows task templates. */
export interface RequirementsListQuery {
  readonly all?: boolean;
  readonly phase?: RequirementsTaskPhase;
}

/** Pinned reorder contract shared by all four catalogs. */
export interface RequirementsReorderEntry {
  readonly id: number;
  readonly sort_order: number;
}

// ---------------------------------------------------------------------------
// documents — onboarding_document_slot
// ---------------------------------------------------------------------------

export interface CreateDocumentSlotInput {
  doc_key: string;
  title: string;
  is_required?: boolean;
  sort_order?: number;
}

export interface UpdateDocumentSlotInput {
  title?: string;
  is_required?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

// ---------------------------------------------------------------------------
// orientation — orientation_topic
// ---------------------------------------------------------------------------

export interface CreateOrientationTopicInput {
  code?: string;
  title: string;
  track: OrientationTrack;
  is_required?: boolean;
}

export interface UpdateOrientationTopicInput {
  title?: string;
  is_required?: boolean;
  is_active?: boolean;
}

// ---------------------------------------------------------------------------
// equipment — onboarding_equipment_item
// ---------------------------------------------------------------------------

export interface CreateEquipmentItemInput {
  item_key: string;
  label: string;
  issuer: EquipmentIssuer;
  is_required?: boolean;
  sort_order?: number;
}

export interface UpdateEquipmentItemInput {
  label?: string;
  issuer?: EquipmentIssuer;
  is_required?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

// ---------------------------------------------------------------------------
// task templates — onboarding_task_template (documents / training / equipment)
// ---------------------------------------------------------------------------

// Orientation-phase templates are DERIVED from orientation topics and edited
// through the orientation catalog — the task-template catalog manages only
// these three phases (mirrors `requirements-api.schema.ts`, server-only).
export const REQUIREMENTS_TASK_PHASES = [
  "documents",
  "training",
  "equipment",
] as const;

export type RequirementsTaskPhase = (typeof REQUIREMENTS_TASK_PHASES)[number];

export interface CreateTaskTemplateInput {
  code: string;
  title: string;
  phase: RequirementsTaskPhase;
  owner_role: OnboardingOwnerRole;
  is_required?: boolean;
  sort_order?: number;
}

export interface UpdateTaskTemplateInput {
  title?: string;
  phase?: RequirementsTaskPhase;
  owner_role?: OnboardingOwnerRole;
  is_required?: boolean;
  is_active?: boolean;
  sort_order?: number;
}
