import type {
  OnboardingTask,
  OnboardingTaskTemplate,
} from "../types/onboarding-task.schema";
import {
  completeOnboardingTask,
  listOnboardingTasks,
  materializeOnboardingTasks,
} from "../tasks/server/onboarding-task-service";
import {
  ensureOnboardingTaskTemplates,
  listOnboardingTaskTemplates,
} from "../tasks/server/task-template-service";
import {
  findTopic,
  listAllTopics,
  listTopics,
  orientationTopicCode,
} from "./orientationStore";
import type {
  OrientationCheck,
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
//
// Todo 7 of onboarding-requirements-config — DB topics + the UNION view:
// the catalog is read from the DB (`orientation_topic`, async) and the state
// set is the UNION of (ACTIVE topics) ∪ (topics that already have a
// per-employee task). The union governs resolution/display/check-off ONLY: an
// employee who already holds a task for a deactivated topic keeps a visible,
// check-off-able item. Requiredness does NOT follow the union — an inactive
// topic is never required and never blocks completion (todo-10 soft-delete
// rule); new task materialization stays the task engine's concern, where
// todo 10 restricts `doMaterialize` to ACTIVE templates.

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

/**
 * Topic ids that already have a per-employee task: the topic's derived
 * template row is referenced by one of the employee's `onboarding_task` rows.
 * This is the "already assigned" half of the todo-7 union — it drives
 * resolution/display/check-off ONLY, never requiredness.
 */
function assignedTopicIds(
  topics: readonly OrientationTopic[],
  templatesByCode: Map<string, OnboardingTaskTemplate>,
  tasks: readonly OnboardingTask[]
): Set<string> {
  const templateIdsWithTask = new Set(
    tasks
      .map((task) => task.template_id)
      .filter((id): id is number => id !== null)
  );
  const assigned = new Set<string>();
  for (const topic of topics) {
    const template = templatesByCode.get(orientationTopicCode(topic.id));
    if (template && templateIdsWithTask.has(template.id)) assigned.add(topic.id);
  }
  return assigned;
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
 * Read-only: never materializes tasks, never seeds.
 *
 * The displayed set is the UNION of the ACTIVE topic catalog and the topics
 * that already have a per-employee task, so an employee who already holds a
 * task for a deactivated topic keeps a visible, check-off-able item. The union
 * governs resolution/display/check-off ONLY: inactive topics are forced
 * `required: false`, so deactivation never blocks completion.
 * @param userId - `user.user_id`.
 * @returns The state view.
 * @throws Error with `ONBOARDING_TASK_*` codes when a Directus read fails.
 */
export async function getOrientationState(
  userId: number
): Promise<OrientationState> {
  const [activeTopics, allTopics, templates, tasks] = await Promise.all([
    listTopics(),
    listAllTopics(),
    listOnboardingTaskTemplates(),
    listOnboardingTasks({ userId }),
  ]);
  const templatesByCode = orientationTemplatesById(templates);
  const activeIds = new Set(activeTopics.map((topic) => topic.id));
  const assigned = assignedTopicIds(allTopics, templatesByCode, tasks);
  const topics = allTopics
    .filter((topic) => activeIds.has(topic.id) || assigned.has(topic.id))
    .map((topic) =>
      activeIds.has(topic.id) ? topic : { ...topic, required: false }
    );
  const checks = buildChecks(userId, topics, templatesByCode, tasks);
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
 * Completes one orientation topic for one employee. Ensures the template
 * catalog FIRST (an HR-added topic must be check-off-able immediately), then
 * gates on the todo-7 union — the topic must be ACTIVE or the employee must
 * already hold its task — materializes the employee's missing tasks and
 * completes the topic's task row. Re-reads the state so a 200 can never report
 * a write that is not visible.
 * @param input - `{ userId, topicId, actorId }`; `actorId` is the session
 * actor written to `completed_by` (null when the session has no numeric sub).
 * @returns The recorded check + the recomputed done predicate.
 * @throws `ORIENTATION_TOPIC_NOT_FOUND` / `ORIENTATION_TASK_NOT_FOUND` when
 * the topic is unknown or has no orientation task row for that employee
 * (active ∪ already-assigned gate; no writes for that topic);
 * `ONBOARDING_TASK_USER_NOT_FOUND` when the employee does not exist;
 * `ORIENTATION_WRITE_NOT_VISIBLE` when the completion is not readable back.
 */
export async function checkOffOrientationTopic(input: {
  userId: number;
  topicId: string;
  actorId: number | null;
}): Promise<CheckOffOrientationResult> {
  await ensureOnboardingTaskTemplates({ actorId: input.actorId });

  const topic = await findTopic(input.topicId);
  if (!topic) {
    fail(
      ORIENTATION_ERROR_CODES.topicNotFound,
      `unknown orientation topic '${input.topicId}'`
    );
  }

  const [activeTopics, templates, before] = await Promise.all([
    listTopics(),
    listOnboardingTaskTemplates(),
    listOnboardingTasks({ userId: input.userId }),
  ]);
  const templatesByCode = orientationTemplatesById(templates);
  const template = templatesByCode.get(orientationTopicCode(topic.id));
  if (!template) {
    fail(
      ORIENTATION_ERROR_CODES.taskNotFound,
      `topic '${topic.id}' has no orientation task template`
    );
  }

  const isActive = activeTopics.some((row) => row.id === topic.id);
  const assignedBefore = assignedTopicIds(
    [topic],
    templatesByCode,
    before
  ).has(topic.id);
  if (!isActive && !assignedBefore) {
    fail(
      ORIENTATION_ERROR_CODES.taskNotFound,
      `employee ${input.userId} has no orientation task for deactivated topic '${topic.id}'`
    );
  }

  await materializeOnboardingTasks({
    userId: input.userId,
    actorId: input.actorId,
  });

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
