import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import type {
  OnboardingTask,
  OnboardingTaskTemplate,
} from "../types/onboarding-task.schema";
import {
  completeOnboardingTask,
  listOnboardingTasks,
  materializeOnboardingTasks,
} from "../tasks/server/onboarding-task-service";
import { listOnboardingTaskTemplates } from "../tasks/server/task-template-service";
import {
  findTopic,
  listTopics,
  orientationTopicCode,
} from "./orientationStore";
import type {
  OrientationCheck,
  OrientationEmployee,
  OrientationTopic,
} from "./types/orientation.schema";

// orientation-task-service.ts — the employee-keyed orientation engine (todo 20).
//
// Orientation state is a VIEW over the todo-19 task engine: one
// `onboarding_task` row per topic (`code = orientationTopicCode(topicId)`,
// phase `orientation`) keyed to `user_id`. Checking a topic off completes THAT
// row; there is no in-memory check map and no `profile_id` path.
//
// Ownership gate (no client-asserted role): the check endpoint can only
// complete a topic that EXISTS in the orientation catalog AND has an
// orientation-phase task row for the addressed employee. A non-orientation or
// unknown topic answers `ORIENTATION_TOPIC_NOT_FOUND` /
// `ORIENTATION_TASK_NOT_FOUND` with ZERO writes; the session actor is only
// written to `completed_by` (attribution, never impersonation).

export const ORIENTATION_ERROR_CODES = {
  topicNotFound: "ORIENTATION_TOPIC_NOT_FOUND",
  taskNotFound: "ORIENTATION_TASK_NOT_FOUND",
  writeNotVisible: "ORIENTATION_WRITE_NOT_VISIBLE",
  employeeReadFailed: "ORIENTATION_EMPLOYEE_READ_FAILED",
} as const;

export const ORIENTATION_PHASE = "orientation";

export interface OrientationState {
  topics: OrientationTopic[];
  checks: OrientationCheck[];
  done: boolean;
}

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

function orientationTemplatesById(
  templates: readonly OnboardingTaskTemplate[]
): Map<string, OnboardingTaskTemplate> {
  const byCode = new Map<string, OnboardingTaskTemplate>();
  for (const template of templates) {
    if (template.phase === ORIENTATION_PHASE) byCode.set(template.code, template);
  }
  return byCode;
}

function buildChecks(
  userId: number,
  topics: readonly OrientationTopic[],
  templatesByCode: Map<string, OnboardingTaskTemplate>,
  tasks: readonly OnboardingTask[]
): OrientationCheck[] {
  const tasksByTemplateId = new Map<number, OnboardingTask>();
  for (const task of tasks) {
    if (task.template_id !== null) tasksByTemplateId.set(task.template_id, task);
  }
  const checks: OrientationCheck[] = [];
  for (const topic of topics) {
    const template = templatesByCode.get(orientationTopicCode(topic.id));
    if (!template) continue;
    const task = tasksByTemplateId.get(template.id);
    if (!task || task.status !== "done") continue;
    checks.push({
      user_id: userId,
      topic_id: topic.id,
      checked_by: task.completed_by,
      checked_at: task.completed_at ?? task.updated_at ?? task.created_at ?? "",
    });
  }
  return checks;
}

/**
 * @param topics - Orientation catalog.
 * @param checks - Recorded checks for one employee.
 * @returns True iff EVERY required topic is checked (required spans both
 * tracks). Zero required topics answers false — the old store contract.
 */
export function computeOrientationDone(
  topics: readonly OrientationTopic[],
  checks: readonly OrientationCheck[]
): boolean {
  const required = topics.filter((topic) => topic.required);
  if (required.length === 0) return false;
  const checked = new Set(checks.map((check) => check.topic_id));
  return required.every((topic) => checked.has(topic.id));
}

/**
 * Reads the full orientation state for one employee (topics + checks + done).
 * Read-only: never materializes tasks.
 * @param userId - `user.user_id`.
 * @returns The state view.
 * @throws Error with `ONBOARDING_TASK_*` codes when a Directus read fails.
 */
export async function getOrientationState(
  userId: number
): Promise<OrientationState> {
  const topics = listTopics();
  const [templates, tasks] = await Promise.all([
    listOnboardingTaskTemplates(),
    listOnboardingTasks({ userId }),
  ]);
  const checks = buildChecks(
    userId,
    topics,
    orientationTemplatesById(templates),
    tasks
  );
  return { topics, checks, done: computeOrientationDone(topics, checks) };
}

/**
 * @param userId - `user.user_id`.
 * @returns True iff the employee's REQUIRED orientation tasks are all done.
 */
export async function isOrientationDone(userId: number): Promise<boolean> {
  return (await getOrientationState(userId)).done;
}

export interface CheckOffOrientationResult {
  check: OrientationCheck;
  done: boolean;
}

/**
 * Completes one orientation topic for one employee. Materializes the
 * employee's task set first when absent (idempotent hire-contract call), then
 * completes the topic's task row and re-reads the state so a 200 can never
 * report a write that is not visible.
 * @param input - `{ userId, topicId, actorId }`; `actorId` is the session
 * actor written to `completed_by` (null when the session has no numeric sub).
 * @returns The recorded check + the recomputed done predicate.
 * @throws `ORIENTATION_TOPIC_NOT_FOUND` / `ORIENTATION_TASK_NOT_FOUND` when
 * the topic is unknown or has no orientation task row for that employee (no
 * writes); `ONBOARDING_TASK_USER_NOT_FOUND` when the employee does not exist;
 * `ORIENTATION_WRITE_NOT_VISIBLE` when the completion is not readable back.
 */
export async function checkOffOrientationTopic(input: {
  userId: number;
  topicId: string;
  actorId: number | null;
}): Promise<CheckOffOrientationResult> {
  const topic = findTopic(input.topicId);
  if (!topic) {
    fail(
      ORIENTATION_ERROR_CODES.topicNotFound,
      `unknown orientation topic '${input.topicId}'`
    );
  }

  await materializeOnboardingTasks({
    userId: input.userId,
    actorId: input.actorId,
  });

  const templatesByCode = orientationTemplatesById(
    await listOnboardingTaskTemplates()
  );
  const template = templatesByCode.get(orientationTopicCode(topic.id));
  if (!template) {
    fail(
      ORIENTATION_ERROR_CODES.taskNotFound,
      `topic '${topic.id}' has no orientation task template`
    );
  }
  const tasks = await listOnboardingTasks({ userId: input.userId });
  const task = tasks.find((row) => row.template_id === template.id) ?? null;
  if (!task) {
    fail(
      ORIENTATION_ERROR_CODES.taskNotFound,
      `employee ${input.userId} has no orientation task for topic '${topic.id}'`
    );
  }

  if (task.status !== "done") {
    await completeOnboardingTask({
      taskId: task.id,
      completedBy: input.actorId,
    });
  }

  const state = await getOrientationState(input.userId);
  const check = state.checks.find((row) => row.topic_id === topic.id) ?? null;
  if (!check) {
    fail(
      ORIENTATION_ERROR_CODES.writeNotVisible,
      `check for topic '${topic.id}' is not visible after completion`
    );
  }
  return { check, done: state.done };
}

const EmployeeRowSchema = z.object({
  user_id: z.number().int().positive(),
  user_fname: z.string().nullable(),
  user_lname: z.string().nullable(),
});

/**
 * The tab's employee roster (`user` rows, newest id first). Read-only and
 * lightweight — the transitional picker until the hub roster (todo 27) owns
 * hire selection.
 * @returns One entry per employee with a display name.
 * @throws `ORIENTATION_EMPLOYEE_READ_FAILED` when the read fails (never a
 * silent empty roster).
 */
export async function listOrientationEmployees(): Promise<
  OrientationEmployee[]
> {
  const body: unknown = await dFetch(
    "/items/user?fields=user_id,user_fname,user_lname&sort=-user_id&limit=-1"
  );
  const parsed = z.object({ data: z.array(EmployeeRowSchema) }).safeParse(body);
  if (!parsed.success) {
    fail(
      ORIENTATION_ERROR_CODES.employeeReadFailed,
      `user roster read failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  return parsed.data.data.map((row) => ({
    user_id: row.user_id,
    name:
      [row.user_fname, row.user_lname].filter(Boolean).join(" ").trim() ||
      `Employee #${row.user_id}`,
  }));
}
