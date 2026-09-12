import { isTaskSatisfied } from "@/modules/human-resource-management/onboarding/completion/completionChecklist";
import type {
  OnboardingTask,
  OnboardingTaskTemplate,
} from "@/modules/human-resource-management/onboarding/types/onboarding-task.schema";

import { orderPhases } from "./rosterData";
import type {
  HireRosterRow,
  HireRosterStatus,
} from "./types/hire-roster.schema";

// rosterBuilder.ts — the pure join behind the onboarding hub roster (todo 27):
// employee-keyed tasks x template catalog x employee names -> one enriched row
// per hire. No I/O and no React; the server service feeds it real rows.

export interface HireRosterEmployee {
  user_id: number;
  name: string;
}

export interface HireRosterInput {
  tasks: readonly OnboardingTask[];
  templates: readonly OnboardingTaskTemplate[];
  employees: readonly HireRosterEmployee[];
}

interface EnrichedTask {
  task: OnboardingTask;
  label: string;
  phase: string;
  sortOrder: number;
  required: boolean;
  satisfied: boolean;
}

/** Tasks with no template row are required and sorted last (fail closed). */
const UNTEMPLATED_SORT_ORDER = Number.MAX_SAFE_INTEGER;

const STATUS_RANK: Record<HireRosterStatus, number> = {
  blocked: 0,
  in_progress: 1,
  not_started: 2,
  complete: 3,
};

function byChecklistOrder(a: EnrichedTask, b: EnrichedTask): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.task.id - b.task.id;
}

function buildRow(
  userId: number,
  userTasks: readonly OnboardingTask[],
  templateById: Map<number, OnboardingTaskTemplate>,
  name: string | undefined
): HireRosterRow {
  const enriched: EnrichedTask[] = userTasks.map((task) => {
    const template =
      task.template_id === null
        ? undefined
        : templateById.get(task.template_id);
    return {
      task,
      label: template?.title ?? `Task #${task.id}`,
      phase: template?.phase ?? "custom",
      sortOrder: template?.sort_order ?? UNTEMPLATED_SORT_ORDER,
      // Todo-10 soft-delete rule: an inactive catalog row is never required,
      // so it can neither block the hire nor become the next action; a task
      // with no template row stays required (fail closed).
      required: template
        ? template.is_active === true && template.is_required === true
        : true,
      satisfied: isTaskSatisfied(task.status),
    };
  });

  const requiredItems = enriched.filter((item) => item.required);
  const requiredDone = requiredItems.filter((item) => item.satisfied).length;
  const requiredTotal = requiredItems.length;
  const open = requiredItems
    .filter((item) => !item.satisfied)
    .sort(byChecklistOrder);
  const blockers = open.filter((item) => item.task.status === "blocked");
  const actionable = open.filter((item) => item.task.status !== "blocked");
  const next = actionable[0] ?? blockers[0] ?? null;
  const dueItem =
    open
      .filter((item) => item.task.due_date !== null)
      .sort((a, b) =>
        (a.task.due_date as string).localeCompare(b.task.due_date as string)
      )[0] ?? null;

  const status: HireRosterStatus =
    requiredTotal > 0 && requiredDone === requiredTotal
      ? "complete"
      : blockers.length > 0
        ? "blocked"
        : requiredDone > 0 ||
            enriched.some((item) => item.task.status === "in_progress")
          ? "in_progress"
          : "not_started";

  const phaseProgress = orderPhases(
    requiredItems.map((item) => item.phase)
  ).map((phase) => {
    const inPhase = requiredItems.filter((item) => item.phase === phase);
    return {
      phase,
      done: inPhase.filter((item) => item.satisfied).length,
      total: inPhase.length,
    };
  });

  return {
    userId,
    name: name ?? `Employee #${userId}`,
    status,
    phase: open[0]?.phase ?? null,
    phases: [...new Set(enriched.map((item) => item.phase))],
    phaseProgress,
    requiredDone,
    requiredTotal,
    nextAction: next
      ? {
          taskId: next.task.id,
          label: next.label,
          ownerRole: next.task.owner_role,
          dueDate: next.task.due_date,
          blocked: next.task.status === "blocked",
        }
      : null,
    ownerRole: next?.task.owner_role ?? null,
    dueDate: dueItem?.task.due_date ?? null,
    blockers: blockers.map((item) => ({
      taskId: item.task.id,
      label: item.label,
      notes: item.task.notes,
    })),
  };
}

/**
 * Joins the employee-keyed task set to the template catalog and the employee
 * directory into one enriched roster row per hire, "needs attention" first
 * (blocked -> in progress -> not started -> complete, then by name).
 * @param input - Real task rows, the seeded catalog, and employee names.
 * @returns Rows ready for the roster table; empty when no tasks exist.
 */
export function buildHireRosterRows(input: HireRosterInput): HireRosterRow[] {
  const templateById = new Map(
    input.templates.map((template) => [template.id, template])
  );
  const nameByUser = new Map(
    input.employees.map((employee) => [employee.user_id, employee.name])
  );

  const tasksByUser = new Map<number, OnboardingTask[]>();
  for (const task of input.tasks) {
    const list = tasksByUser.get(task.user_id);
    if (list) list.push(task);
    else tasksByUser.set(task.user_id, [task]);
  }

  const rows = [...tasksByUser.entries()].map(([userId, userTasks]) =>
    buildRow(userId, userTasks, templateById, nameByUser.get(userId))
  );

  rows.sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    return rank !== 0 ? rank : a.name.localeCompare(b.name);
  });
  return rows;
}
