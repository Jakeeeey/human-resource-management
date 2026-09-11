import { DEFAULT_ORIENTATION_TOPICS } from "../orientation/orientationSeed";
import {
  TRACK_OWNER,
  orientationTopicCode,
} from "../orientation/orientationStore";
import type { OnboardingOwnerRole } from "../types/onboarding-task.schema";

// taskTemplateSeed.ts — the post-hire task catalog source (todo 19).
//
// ONE seed row per trackable onboarding unit, grouped in the four phases the
// plan names (documents / orientation / training / equipment). Content is
// SOURCED, never invented:
//
//   - `documents` rows mirror the pdf §10 checklist items `docs` /
//     `hr_verify` / `ack` (onboarding/completion/completionChecklist.ts);
//   - `orientation` rows are DERIVED from `DEFAULT_ORIENTATION_TOPICS`
//     (orientationSeed.ts is the ONLY place topic titles live) with the
//     responsible party from `TRACK_OWNER` (company -> hr, department ->
//     department) and the shared `orientationTopicCode` mapping (todo 20);
//   - `training` rows mirror the §10 `training` item (HR assigns, hiree
//     completes);
//   - `equipment` rows mirror the §10 `access` + `equipment` items.
//
// `ensureOnboardingTaskTemplates` (server/task-template-service.ts) upserts
// these rows by `code`; this file stays pure data so services + harnesses can
// import it without side effects.

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
}

/** §10 `docs` / `hr_verify` / `ack`, in fixed checklist order. */
const DOCUMENT_TEMPLATES: readonly OnboardingTaskTemplateSeed[] = [
  {
    code: "documents_submitted",
    title: "Required documents submitted",
    phase: "documents",
    owner_role: "hiree",
    is_required: true,
    sort_order: 10,
  },
  {
    code: "documents_hr_verified",
    title: "HR verification approved",
    phase: "documents",
    owner_role: "hr",
    is_required: true,
    sort_order: 20,
  },
  {
    code: "documents_acknowledged",
    title: "Documents acknowledgement recorded",
    phase: "documents",
    owner_role: "hiree",
    is_required: true,
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
    sort_order: 300,
  },
  {
    code: "training_completed",
    title: "Complete assigned training",
    phase: "training",
    owner_role: "hiree",
    is_required: true,
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
    sort_order: 400,
  },
  {
    code: "equipment_issued",
    title: "Equipment fully issued",
    phase: "equipment",
    owner_role: "department",
    is_required: true,
    sort_order: 410,
  },
  {
    code: "equipment_acknowledged",
    title: "Equipment acknowledgement recorded",
    phase: "equipment",
    owner_role: "hiree",
    is_required: true,
    sort_order: 420,
  },
];

const ORIENTATION_SORT_BASE = 100;

/**
 * One template per orientation topic (company track first, then department),
 * titles taken from the seed so topics never appear as literals elsewhere.
 */
function buildOrientationTemplates(): OnboardingTaskTemplateSeed[] {
  return DEFAULT_ORIENTATION_TOPICS.map((topic, index) => ({
    code: orientationTopicCode(topic.id),
    title: topic.title,
    phase: "orientation",
    owner_role: TRACK_OWNER[topic.track],
    is_required: topic.required,
    sort_order: ORIENTATION_SORT_BASE + (index + 1) * 10,
  }));
}

/** The complete seed catalog in phase order, deterministic sort. */
export function listOnboardingTaskTemplateSeed(): OnboardingTaskTemplateSeed[] {
  return [
    ...DOCUMENT_TEMPLATES,
    ...buildOrientationTemplates(),
    ...TRAINING_TEMPLATES,
    ...EQUIPMENT_TEMPLATES,
  ];
}
