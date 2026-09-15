import type {
  TrainingItem,
  TrainingTemplateView,
} from "../../training/types/training-catalog.schema";

// training-templates.schema.ts — CLIENT-SAFE contracts for the Training
// Templates admin catalog (master-detail). This module carries TYPES ONLY (no
// zod, no runtime values beyond one string sentinel) and aliases the row shapes
// from the training catalog with `import type`, so nothing here reaches the
// browser bundle. The server request-body schemas stay in the (server-only)
// training module; the input interfaces below MIRROR the frozen API contract.
//
// If a create/update body changes, change the matching interface here too (the
// route answers 400 on an unknown/missing key either way).

/** `onboarding_training_template` row as returned by the API. */
export type TrainingTemplateRow = TrainingTemplateView;

/** `onboarding_training_item` row as returned by the API. */
export type TrainingItemRow = TrainingItem;

/** A template with its child items nested (the list GET shape). */
export interface TemplateWithItems extends TrainingTemplateView {
  items: TrainingItem[];
}

/** `?all=1` includes deactivated rows; the admin surface always lists all. */
export interface TrainingTemplatesListQuery {
  readonly all?: boolean;
}

export interface CreateTrainingTemplateInput {
  code: string;
  title: string;
  description?: string | null;
  /** Empty/absent = GLOBAL template (applies to every department). */
  department_ids?: number[];
}

export interface UpdateTrainingTemplateInput {
  title?: string;
  description?: string | null;
  /** Empty = GLOBAL; absent leaves the current department scope untouched. */
  department_ids?: number[];
  is_active?: boolean;
}

export interface CreateTrainingItemInput {
  code: string;
  title: string;
  description?: string | null;
  is_required?: boolean;
  sort_order?: number;
}

export interface UpdateTrainingItemInput {
  title?: string;
  description?: string | null;
  is_required?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

/** Minimal department shape the template selector needs. */
export interface DepartmentOption {
  department_id: number;
  department_name: string;
}

/**
 * Sentinel value for the toolbar's GLOBAL department filter. It is a FILTER
 * token only — a template's global scope is an EMPTY department set, never a
 * `__global__` junction row.
 */
export const GLOBAL_DEPARTMENT_VALUE = "__global__";
