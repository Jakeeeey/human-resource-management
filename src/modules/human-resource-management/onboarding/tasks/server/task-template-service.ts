import {
  ONBOARDING_TASK_ERROR_CODES,
  createTemplateRows,
  listTemplateRows,
  phTimeNow,
  type TemplateWriteRow,
} from "./onboardingTaskIo";
import {
  buildOrientationTemplateSeeds,
  listOnboardingTaskTemplateSeed,
} from "../taskTemplateSeed";
import type { OnboardingTaskTemplate } from "../../types/onboarding-task.schema";
import { listTopicRows } from "../../orientation/server/orientationTopicIo";
import { seedMissingCatalogRows } from "./catalogSeed";

// task-template-service.ts — CREATE-MISSING-ONLY template catalog seed
// (todo 2 of onboarding-requirements-config; supersedes the todo-19 upsert).
//
// `ensureOnboardingTaskTemplates()`:
//   - runs the todo-6 catalog seeder FIRST (orientation_topic /
//     onboarding_document_slot / onboarding_equipment_item), so a fresh
//     `orientation_topic` table is populated BEFORE orientation rows derive;
//   - derives orientation template rows from the PERSISTED topic catalog
//     (`buildOrientationTemplateSeeds`, code via the ONE `orientationTopicCode`
//     formula) and takes documents / training / equipment from the code
//     defaults;
//   - CREATES only codes that are absent (ONE batch POST when any). An
//     existing row is NEVER overwritten — title / is_required / phase /
//     owner_role / sort_order / is_active all stay as the DB holds them: the
//     DB is authoritative after the first seed;
//   - re-runs are true no-ops (zero writes);
//   - read-back verify: every seed code MUST be visible after the writes
//     (never a misleading success).
// There is no DELETE and no PATCH here: retiring/editing rows is a human data
// decision, not a seed side effect.

export interface TemplateSeedSummary {
  total: number;
  created: string[];
  unchanged: number;
}

/** The seeded catalog, phase/sort order (read-only; no writes). */
export function listOnboardingTaskTemplates(): Promise<
  OnboardingTaskTemplate[]
> {
  return listTemplateRows();
}

export interface TemplateSeedResult {
  summary: TemplateSeedSummary;
  /** The verified catalog rows (post-seed) for the materialize caller. */
  templates: OnboardingTaskTemplate[];
}

/**
 * Creates the template codes that are absent from `onboarding_task_template`.
 * Safe to call on every hire: a fully seeded catalog produces zero writes.
 * @param input - Optional actor id for `created_by` / `updated_by`.
 * @returns The seed summary + the verified catalog.
 * @throws Error with `ONBOARDING_TASK_ERROR_CODES.templateWriteFailed` when a
 * seed code is not visible after the writes.
 */
export async function ensureOnboardingTaskTemplates(input?: {
  actorId?: number | null;
}): Promise<TemplateSeedResult> {
  const actorId = input?.actorId ?? null;
  // Todo 6: seed the three new catalog collections (orientation topics,
  // document slots, equipment items) BEFORE any template derivation — a fresh
  // / empty `orientation_topic` table must still yield orientation tasks.
  await seedMissingCatalogRows({ actorId });

  // Todo 2: orientation rows derive from ALL persisted topics (inactive ones
  // included; their derived template is created with their current flag).
  const [topics, existing] = await Promise.all([
    listTopicRows(),
    listTemplateRows(),
  ]);
  const seed = [
    ...listOnboardingTaskTemplateSeed(),
    ...buildOrientationTemplateSeeds(topics),
  ];
  const byCode = new Set(existing.map((row) => row.code));
  const missing = seed.filter((row) => !byCode.has(row.code));

  const now = phTimeNow();
  const createdCodes: string[] = [];
  if (missing.length > 0) {
    const rows: TemplateWriteRow[] = missing.map((row) => ({
      ...row,
      created_at: now,
      created_by: actorId,
      updated_at: now,
      updated_by: actorId,
    }));
    const created = await createTemplateRows(rows);
    createdCodes.push(...created.map((row) => row.code));
  }

  const verified = await listTemplateRows();
  const verifiedCodes = new Set(verified.map((row) => row.code));
  const missingAfter = seed.filter((row) => !verifiedCodes.has(row.code));
  if (missingAfter.length > 0) {
    throw new Error(
      `${ONBOARDING_TASK_ERROR_CODES.templateWriteFailed}: seed codes not visible after write: ${missingAfter
        .map((row) => row.code)
        .join(",")}`
    );
  }

  return {
    summary: {
      total: seed.length,
      created: createdCodes,
      unchanged: seed.length - createdCodes.length,
    },
    templates: verified,
  };
}
