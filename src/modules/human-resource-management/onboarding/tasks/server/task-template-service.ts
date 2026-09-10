import {
  ONBOARDING_TASK_ERROR_CODES,
  createTemplateRows,
  listTemplateRows,
  patchTemplateRow,
  phTimeNow,
  type TemplateWriteRow,
} from "./onboardingTaskIo";
import {
  listOnboardingTaskTemplateSeed,
  type OnboardingTaskTemplateSeed,
} from "../taskTemplateSeed";
import type { OnboardingTaskTemplate } from "../../types/onboarding-task.schema";

// task-template-service.ts — idempotent template catalog seed (todo 19).
//
// `ensureOnboardingTaskTemplates()` UPSERTS the code-owned catalog by `code`:
//   - missing code            -> batch create (ONE POST);
//   - existing code with drift -> PATCH back to the seed (the seed wins for
//     title / phase / owner_role / is_required / sort_order);
//   - identical row           -> NO write at all (re-runs are true no-ops);
//   - read-back verify        -> every seed code MUST be visible after the
//     writes (never a misleading success).
// There is no DELETE here: retiring a code is a data decision, not a seed
// side effect, and old rows must not be resurrected by a later re-run.

export interface TemplateSeedSummary {
  total: number;
  created: string[];
  updated: string[];
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

function seedPatch(
  existing: OnboardingTaskTemplate,
  seed: OnboardingTaskTemplateSeed
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (existing.title !== seed.title) patch.title = seed.title;
  if (existing.phase !== seed.phase) patch.phase = seed.phase;
  if (existing.owner_role !== seed.owner_role) {
    patch.owner_role = seed.owner_role;
  }
  if (existing.is_required !== seed.is_required) {
    patch.is_required = seed.is_required;
  }
  if (existing.sort_order !== seed.sort_order) {
    patch.sort_order = seed.sort_order;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Seeds/repairs the `onboarding_task_template` catalog from the code-owned
 * `taskTemplateSeed` rows. Safe to call on every hire: a fully seeded catalog
 * produces zero writes.
 * @param input - Optional actor id for `created_by` / `updated_by`.
 * @returns The seed summary + the verified catalog.
 * @throws Error with `ONBOARDING_TASK_ERROR_CODES.templateWriteFailed` when a
 * seed code is not visible after the writes.
 */
export async function ensureOnboardingTaskTemplates(input?: {
  actorId?: number | null;
}): Promise<TemplateSeedResult> {
  const actorId = input?.actorId ?? null;
  const seed = listOnboardingTaskTemplateSeed();
  const existing = await listTemplateRows();
  const byCode = new Map(existing.map((row) => [row.code, row]));

  const missing = seed.filter((row) => !byCode.has(row.code));
  const changed: Array<{
    existing: OnboardingTaskTemplate;
    patch: Record<string, unknown>;
  }> = [];
  for (const row of seed) {
    const current = byCode.get(row.code);
    if (!current) continue;
    const patch = seedPatch(current, row);
    if (patch) changed.push({ existing: current, patch });
  }

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

  const updatedCodes: string[] = [];
  for (const { existing: current, patch } of changed) {
    await patchTemplateRow(current.id, {
      ...patch,
      updated_at: now,
      updated_by: actorId,
    });
    updatedCodes.push(current.code);
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
      updated: updatedCodes,
      unchanged: seed.length - createdCodes.length - updatedCodes.length,
    },
    templates: verified,
  };
}
