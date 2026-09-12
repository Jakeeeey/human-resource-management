import { DEFAULT_ORIENTATION_TOPICS } from "../orientation/orientationSeed";
import {
  TRACK_OWNER,
  orientationTopicCode,
} from "../orientation/orientationStore";
import type { OrientationTrack } from "../orientation/types/orientation.schema";
import type { OnboardingOwnerRole } from "../types/onboarding-task.schema";

// taskTemplateSeed.ts — the code-owned DEFAULTS for the post-hire task
// catalog, grouped in the four phases the plan names (documents / orientation /
// training / equipment). Content is SOURCED, never invented:
//
//   - `documents` rows mirror the pdf §10 checklist items `docs` /
//     `hr_verify` / `ack` (onboarding/completion/completionChecklist.ts);
//   - `orientation` rows are NO LONGER code-owned (todo 2 of
//     onboarding-requirements-config): the persisted `orientation_topic`
//     catalog is the source and `buildOrientationTemplateSeeds` derives one
//     row per topic with the responsible party from `TRACK_OWNER` (company ->
//     hr, department -> department). `buildOrientationTemplates` stays as the
//     PARITY ORACLE of the legacy code-seed output (never used at runtime);
//   - `training` rows mirror the §10 `training` item (HR assigns, hiree
//     completes);
//   - `equipment` rows mirror the §10 `access` + `equipment` items.
//
// `ensureOnboardingTaskTemplates` (server/task-template-service.ts) CREATES
// these rows only for codes that are absent; this file stays pure data /
// derivation so services + harnesses can import it without side effects.

export const ONBOARDING_TASK_PHASES = [
  "documents",
  "orientation",
  "training",
  "equipment",
] as const;

export type OnboardingTaskPhase = (typeof ONBOARDING_TASK_PHASES)[number];

export interface OnboardingTaskTemplateSeed {
  code: string;
  title: string;
  phase: OnboardingTaskPhase;
  owner_role: OnboardingOwnerRole;
  is_required: boolean;
  sort_order: number;
  /**
   * Applied on CREATE only — an existing row's flag is NEVER overwritten
   * (create-missing seeding). Orientation rows inherit the topic's current
   * `is_active`; every other default row is created active.
   */
  is_active: boolean;
}

/** §10 `docs` / `hr_verify` / `ack`, in fixed checklist order. */
const DOCUMENT_TEMPLATES: readonly OnboardingTaskTemplateSeed[] = [
  {
    code: "documents_submitted",
    title: "Required documents submitted",
    phase: "documents",
    owner_role: "hiree",
    is_required: true,
    is_active: true,
    sort_order: 10,
  },
  {
    code: "documents_hr_verified",
    title: "HR verification approved",
    phase: "documents",
    owner_role: "hr",
    is_required: true,
    is_active: true,
    sort_order: 20,
  },
  {
    code: "documents_acknowledged",
    title: "Documents acknowledgement recorded",
    phase: "documents",
    owner_role: "hiree",
    is_required: true,
    is_active: true,
    sort_order: 30,
  },
];

/** §10 `training`: assignment is an HR action, completion belongs to the hiree. */
const TRAINING_TEMPLATES: readonly OnboardingTaskTemplateSeed[] = [
  {
    code: "training_assigned",
    title: "Assign required training",
    phase: "training",
    owner_role: "hr",
    is_required: true,
    is_active: true,
    sort_order: 300,
  },
  {
    code: "training_completed",
    title: "Complete assigned training",
    phase: "training",
    owner_role: "hiree",
    is_required: true,
    is_active: true,
    sort_order: 310,
  },
];

/** §10 `access` (IT-issued -> `system`) + `equipment` (issued by the department, acknowledged by the hiree). */
const EQUIPMENT_TEMPLATES: readonly OnboardingTaskTemplateSeed[] = [
  {
    code: "access_provisioned",
    title: "System access provisioned (email + system access)",
    phase: "equipment",
    owner_role: "system",
    is_required: true,
    is_active: true,
    sort_order: 400,
  },
  {
    code: "equipment_issued",
    title: "Equipment fully issued",
    phase: "equipment",
    owner_role: "department",
    is_required: true,
    is_active: true,
    sort_order: 410,
  },
  {
    code: "equipment_acknowledged",
    title: "Equipment acknowledgement recorded",
    phase: "equipment",
    owner_role: "hiree",
    is_required: true,
    is_active: true,
    sort_order: 420,
  },
];

const ORIENTATION_SORT_BASE = 100;

/** The persisted `orientation_topic` fields the derivation reads. */
export interface OrientationTopicSeedSource {
  /** `orientation_topic.code` (app-level topic id, e.g. `company-background`). */
  code: string;
  title: string;
  track: OrientationTrack;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

/**
 * Derives the orientation template rows from the PERSISTED topic catalog —
 * the create-missing input for todo 2. Company track first, then DB
 * `sort_order` (mirrors `orientationStore.sortTopics`, so the legacy ordering
 * survives). The code uses the ONE `orientationTopicCode` mapping; `is_active`
 * mirrors the topic's current flag.
 */
export function buildOrientationTemplateSeeds(
  topics: readonly OrientationTopicSeedSource[]
): OnboardingTaskTemplateSeed[] {
  return [...topics]
    .sort((a, b) => {
      if (a.track !== b.track) return a.track === "company" ? -1 : 1;
      return a.sort_order - b.sort_order;
    })
    .map((topic, index) => ({
      code: orientationTopicCode(topic.code),
      title: topic.title,
      phase: "orientation",
      owner_role: TRACK_OWNER[topic.track],
      is_required: topic.is_required,
      sort_order: ORIENTATION_SORT_BASE + (index + 1) * 10,
      is_active: topic.is_active,
    }));
}

/**
 * PARITY ORACLE — the legacy (pre-todo-2) code-seed derivation. NOT used at
 * runtime; `buildOrientationTemplateSeeds` must produce the same rows for the
 * default catalog. Kept exported so the parity claim stays executable
 * (evidence `task-2-seed-reconcile.md`).
 */
export function buildOrientationTemplates(): OnboardingTaskTemplateSeed[] {
  return DEFAULT_ORIENTATION_TOPICS.map((topic, index) => ({
    code: orientationTopicCode(topic.id),
    title: topic.title,
    phase: "orientation",
    owner_role: TRACK_OWNER[topic.track],
    is_required: topic.required,
    sort_order: ORIENTATION_SORT_BASE + (index + 1) * 10,
    is_active: true,
  }));
}

/**
 * The code-owned defaults for the non-orientation phases; orientation rows are
 * derived from the DB topic catalog instead (never seeded from code).
 */
export function listOnboardingTaskTemplateSeed(): OnboardingTaskTemplateSeed[] {
  return [...DOCUMENT_TEMPLATES, ...TRAINING_TEMPLATES, ...EQUIPMENT_TEMPLATES];
}
