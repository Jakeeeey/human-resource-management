import {
  ONBOARDING_TASK_ERROR_CODES,
  createTaskRows,
  listTaskRows,
  patchTaskRow,
  phTimeNow,
  readTaskRow,
  readUserExists,
  type TaskWriteRow,
} from "./onboardingTaskIo";
import { ensureOnboardingTaskTemplates } from "./task-template-service";
import type {
  OnboardingOwnerRole,
  OnboardingTask,
  OnboardingTaskStatus,
} from "../../types/onboarding-task.schema";
import type { OnboardingTaskUpdate } from "../types/onboarding-task-api.schema";

// onboarding-task-service.ts — the employee-keyed task engine (todo 19).
//
// `materializeOnboardingTasks` turns the template catalog into per-employee
// `onboarding_task` rows keyed to `user_id` (the ONLY correlation — there is
// no `profile_id` / `onboarding_profiles` path and no applicant<->user link):
//
//   - user must exist   -> else coded `USER_NOT_FOUND` (route 400, NO writes);
//   - templates seeded  -> `ensureOnboardingTaskTemplates()` (idempotent);
//   - missing tasks     -> ONE batch create of every (user_id, template_id)
//     pair absent for this employee;
//   - in-flight mutex   -> concurrent materializations for the same user
//     collapse onto ONE run (resume/retry safe);
//   - read-back verify  -> every template must have a task afterwards, else
//     coded `TASK_WRITE_FAILED` (never a misleading success).
//
// `updateOnboardingTask` / `completeOnboardingTask` are the ONLY status
// writers and keep `completed_at`/`completed_by` coherent on BOTH paths
// (completing via update stamps them exactly like the complete route).

export interface MaterializeOnboardingTasksInput {
  userId: number;
  actorId?: number | null;
}

export interface MaterializeOnboardingTasksResult {
  userId: number;
  templateCount: number;
  created: number;
  existing: number;
  total: number;
  createdTaskIds: number[];
}

/** One in-flight materialization per employee (concurrency guard). */
const materializeInFlight = new Map<
  number,
  Promise<MaterializeOnboardingTasksResult>
>();

async function doMaterialize(
  userId: number,
  actorId: number | null
): Promise<MaterializeOnboardingTasksResult> {
  const userExists = await readUserExists(userId);
  if (!userExists) {
    throw new Error(
      `${ONBOARDING_TASK_ERROR_CODES.userNotFound}: user ${userId} does not exist`
    );
  }

  const { templates } = await ensureOnboardingTaskTemplates({ actorId });

  const current = await listTaskRows({ userId });
  const currentTemplateIds = new Set(
    current
      .map((task) => task.template_id)
      .filter((id): id is number => id !== null)
  );
  const missing = templates.filter(
    (template) => !currentTemplateIds.has(template.id)
  );

  const now = phTimeNow();
  const rows: TaskWriteRow[] = missing.map((template) => ({
    user_id: userId,
    template_id: template.id,
    owner_role: template.owner_role,
    owner_user_id: null,
    status: "pending",
    due_date: null,
    completed_by: null,
    completed_at: null,
    notes: null,
    created_at: now,
    created_by: actorId,
    updated_at: now,
    updated_by: actorId,
  }));
  const createdRows = rows.length > 0 ? await createTaskRows(rows) : [];

  const after = await listTaskRows({ userId });
  const afterTemplateIds = new Set(after.map((task) => task.template_id));
  const missingAfter = templates.filter(
    (template) => !afterTemplateIds.has(template.id)
  );
  if (missingAfter.length > 0) {
    throw new Error(
      `${ONBOARDING_TASK_ERROR_CODES.taskWriteFailed}: templates without a task after materialize: ${missingAfter
        .map((template) => template.code)
        .join(",")}`
    );
  }

  return {
    userId,
    templateCount: templates.length,
    created: createdRows.length,
    existing: current.length,
    total: after.length,
    createdTaskIds: createdRows.map((row) => row.id),
  };
}

/**
 * Materializes every missing task for one employee. Re-running creates ZERO
 * rows (idempotent), concurrent runs collapse onto one, and the employee must
 * exist before any write.
 * @param input - `{ userId, actorId? }`.
 * @returns Counts + the ids created by this run.
 * @throws Error with `ONBOARDING_TASK_ERROR_CODES` on unknown user, template
 * seed failure, or a write that is not visible on read-back.
 */
export function materializeOnboardingTasks(
  input: MaterializeOnboardingTasksInput
): Promise<MaterializeOnboardingTasksResult> {
  const userId = input.userId;
  const actorId = input.actorId ?? null;

  const inFlight = materializeInFlight.get(userId);
  if (inFlight) return inFlight;

  const task = doMaterialize(userId, actorId).finally(() => {
    materializeInFlight.delete(userId);
  });
  materializeInFlight.set(userId, task);
  return task;
}

export interface OnboardingTaskQuery {
  userId?: number;
  status?: OnboardingTaskStatus;
  ownerRole?: OnboardingOwnerRole;
}

export function listOnboardingTasks(
  query: OnboardingTaskQuery
): Promise<OnboardingTask[]> {
  return listTaskRows(query);
}

/**
 * @param taskId - `onboarding_task.id`.
 * @returns The task row.
 * @throws Error with `ONBOARDING_TASK_ERROR_CODES.taskNotFound` when absent.
 */
export async function getOnboardingTask(
  taskId: number
): Promise<OnboardingTask> {
  const task = await readTaskRow(taskId);
  if (!task) {
    throw new Error(
      `${ONBOARDING_TASK_ERROR_CODES.taskNotFound}: onboarding_task ${taskId} does not exist`
    );
  }
  return task;
}

export interface UpdateOnboardingTaskInput {
  taskId: number;
  patch: OnboardingTaskUpdate;
  actorId?: number | null;
}

/**
 * Applies a partial update (`status` / `notes` / `due_date` /
 * `owner_user_id`). Moving a task to `done` stamps `completed_at` /
 * `completed_by` when they were empty; moving it back out of `done` clears
 * them — the completion audit never disagrees with the status.
 * @throws Error with `ONBOARDING_TASK_ERROR_CODES.taskNotFound` when absent.
 */
export async function updateOnboardingTask(
  input: UpdateOnboardingTaskInput
): Promise<OnboardingTask> {
  const actorId = input.actorId ?? null;
  const current = await getOnboardingTask(input.taskId);
  const now = phTimeNow();
  const patch: Record<string, unknown> = {
    updated_at: now,
    updated_by: actorId,
  };

  if (input.patch.status !== undefined) {
    patch.status = input.patch.status;
    if (input.patch.status === "done" && current.completed_at === null) {
      patch.completed_at = now;
      patch.completed_by = actorId;
    }
    if (input.patch.status !== "done" && current.completed_at !== null) {
      patch.completed_at = null;
      patch.completed_by = null;
    }
  }
  if (input.patch.notes !== undefined) patch.notes = input.patch.notes;
  if (input.patch.due_date !== undefined) patch.due_date = input.patch.due_date;
  if (input.patch.owner_user_id !== undefined) {
    patch.owner_user_id = input.patch.owner_user_id;
  }

  return patchTaskRow(input.taskId, patch);
}

export interface CompleteOnboardingTaskInput {
  taskId: number;
  completedBy: number | null;
}

export interface CompleteOnboardingTaskResult {
  task: OnboardingTask;
  /** True when the task was already `done` (idempotent re-complete). */
  alreadyDone: boolean;
}

/**
 * Marks one task `done` with the completion audit. Re-completing is an
 * idempotent no-op that returns the unchanged row.
 * @throws Error with `ONBOARDING_TASK_ERROR_CODES.taskNotFound` when absent.
 */
export async function completeOnboardingTask(
  input: CompleteOnboardingTaskInput
): Promise<CompleteOnboardingTaskResult> {
  const current = await getOnboardingTask(input.taskId);
  if (current.status === "done") {
    return { task: current, alreadyDone: true };
  }
  const now = phTimeNow();
  const task = await patchTaskRow(input.taskId, {
    status: "done",
    completed_by: input.completedBy,
    completed_at: now,
    updated_at: now,
    updated_by: input.completedBy,
  });
  return { task, alreadyDone: false };
}
