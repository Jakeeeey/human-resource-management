import {
  ONBOARDING_TASK_ERROR_CODES,
  listTaskUserIds,
  listTemplateRows,
  patchTemplateRow,
  phTimeNow,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskIo";
import { materializeOnboardingTasks } from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-service";
import { completeTaskByCode } from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-service";
import { LEGACY_TRAINING_TEMPLATE_CODES } from "@/modules/human-resource-management/onboarding/training/server/trainingCatalogService";

// onboarding-task-backfill-service.ts — maintenance sweep for hires who are
// ALREADY mid-onboarding.
//
// Onboarding tasks are materialized at hire time only, so an employee hired
// before the training redesign can be missing the per-department
// `training_item_*` tasks and can still carry retired
// `training_assigned` / `training_completed` template rows that count as
// required work. `backfillOnboardingTasks` repairs both in ONE idempotent run:
//
//   1. ENUMERATE — every DISTINCT `user_id` owning `onboarding_task` rows
//      (raw Directus read, `limit=-1`: the roster read caps at 500 rows and
//      would silently skip employees);
//   2. CLEAN — deactivate the still-ACTIVE legacy training template rows
//      (`LEGACY_TRAINING_TEMPLATE_CODES`) through the shared template update
//      IO — `is_active=false` ONLY, never a delete — so the workspace
//      checklist stops counting them (required = active AND required);
//   3. MATERIALIZE — call the SAME `materializeOnboardingTasks` the hire flow
//      uses for each employee (idempotent, create-missing, read-back verified,
//      training templates narrowed to the hire's department);
//   3b. PROVISION — complete the employee's open `access_provisioned` task
//      (same `completeTaskByCode` the hire step uses; every swept employee
//      holds a Spring account by construction);
//   4. ISOLATE — one employee's failure is collected per user and never aborts
//      the sweep; the run is repeatable, so leftovers retry on the next call.
//
// Re-running after the catalog settles is a true no-op: `created` is 0 and no
// template is patched.

export interface BackfillUserSummary {
  userId: number;
  created: number;
  existing: number;
}

export interface BackfillUserFailure {
  userId: number;
  message: string;
}

export interface LegacyTrainingTemplateChange {
  id: number;
  code: string;
}

export interface LegacyTrainingTemplateFailure {
  id: number;
  code: string;
  message: string;
}

/** Still-active legacy rows this run found, and what happened to each. */
export interface LegacyTrainingTemplateCleanup {
  /** Active legacy rows matched by this run (0 on a settled re-run). */
  attempted: number;
  /** Ids/codes actually flipped to `is_active=false`. */
  deactivated: LegacyTrainingTemplateChange[];
  /** Rows whose patch failed or was not visible on the returned row. */
  failed: LegacyTrainingTemplateFailure[];
}

export interface BackfillOnboardingTasksResult {
  /** Distinct employees owning `onboarding_task` rows (the sweep size). */
  users: number;
  /** Task rows created across employees (0 on a settled re-run). */
  created: number;
  /** Task rows that already existed across employees. */
  existing: number;
  /** `access_provisioned` tasks flipped to done by this run. */
  accessProvisioned: number;
  perUser: BackfillUserSummary[];
  /** Per-employee failures — these never abort the sweep. */
  errors: BackfillUserFailure[];
  legacyTemplates: LegacyTrainingTemplateCleanup;
}

/** The retired codes as a Set, for a typed membership check on `code`. */
const LEGACY_TRAINING_TEMPLATE_CODE_SET: ReadonlySet<string> = new Set<string>(
  LEGACY_TRAINING_TEMPLATE_CODES
);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Deactivates every still-ACTIVE legacy training template row
 * (`training_assigned` / `training_completed`). Soft-delete only: the row is
 * PATCHed to `is_active=false` through the shared template IO — never deleted —
 * and the flag is confirmed on the returned row before it is reported.
 * @param input - Optional actor id for `updated_by`.
 * @returns Which ids/codes were deactivated, plus per-template failures.
 * @throws Coded template-read error when the catalog itself cannot be read.
 */
export async function deactivateLegacyTrainingTemplates(input: {
  actorId?: number | null;
}): Promise<LegacyTrainingTemplateCleanup> {
  const actorId = input.actorId ?? null;
  const templates = await listTemplateRows();
  const legacy = templates.filter(
    (template) =>
      template.is_active === true &&
      LEGACY_TRAINING_TEMPLATE_CODE_SET.has(template.code)
  );

  const now = phTimeNow();
  const deactivated: LegacyTrainingTemplateChange[] = [];
  const failed: LegacyTrainingTemplateFailure[] = [];

  for (const template of legacy) {
    try {
      const updated = await patchTemplateRow(template.id, {
        is_active: false,
        updated_at: now,
        ...(actorId != null ? { updated_by: actorId } : {}),
      });
      if (updated.is_active !== false) {
        failed.push({
          id: template.id,
          code: template.code,
          message: `${ONBOARDING_TASK_ERROR_CODES.templateWriteFailed}: ${template.code} still reads active after the patch`,
        });
        continue;
      }
      deactivated.push({ id: template.id, code: template.code });
    } catch (error) {
      failed.push({
        id: template.id,
        code: template.code,
        message: errorMessage(error),
      });
    }
  }

  return { attempted: legacy.length, deactivated, failed };
}

/**
 * Backfills onboarding tasks for every employee who owns `onboarding_task`
 * rows. Idempotent: a re-run reports `created: 0` and deactivates nothing.
 * @param input - Session actor id for the audit columns (null when absent).
 * @returns Grand totals, per-employee counts, per-employee errors, and the
 * legacy-template cleanup report.
 * @throws Coded error when the user enumeration or the template catalog read
 * fails — per-employee failures never abort the sweep.
 */
export async function backfillOnboardingTasks(input: {
  actorId?: number | null;
}): Promise<BackfillOnboardingTasksResult> {
  const actorId = input.actorId ?? null;

  // Clean the catalog BEFORE materializing so the final checklist reflects
  // only applicable rows, and an interrupted sweep can never leave retired
  // rows counting as required work.
  const legacyTemplates = await deactivateLegacyTrainingTemplates({ actorId });

  const userIds = await listTaskUserIds();
  const perUser: BackfillUserSummary[] = [];
  const errors: BackfillUserFailure[] = [];
  let created = 0;
  let existing = 0;
  let accessProvisioned = 0;

  // Sequential on purpose: each employee costs a template ensure + several
  // Directus round trips, so the sweep stays gentle on the backend instead of
  // fanning out unbounded. Failures are isolated per employee.
  for (const userId of userIds) {
    try {
      const result = await materializeOnboardingTasks({ userId, actorId });
      perUser.push({
        userId,
        created: result.created,
        existing: result.existing,
      });
      created += result.created;
      existing += result.existing;
      const access = await completeTaskByCode({
        userId,
        phase: "equipment",
        code: "access_provisioned",
        completedBy: actorId,
      });
      if (access.completed) accessProvisioned += 1;
    } catch (error) {
      errors.push({ userId, message: errorMessage(error) });
    }
  }

  return {
    users: userIds.length,
    created,
    existing,
    accessProvisioned,
    perUser,
    errors,
    legacyTemplates,
  };
}
