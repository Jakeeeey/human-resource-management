import { isTaskSatisfied } from "@/modules/human-resource-management/onboarding/completion/completionChecklist";
import type {
  OnboardingOwnerRole,
  OnboardingTask,
  OnboardingTaskStatus,
  OnboardingTaskTemplate,
} from "@/modules/human-resource-management/onboarding/types/onboarding-task.schema";

import { orderPhases, phaseLabel } from "./rosterData";

// workspaceTasks.ts — pure phase grouping for the per-hire onboarding
// workspace (todo 28). `onboarding_task` rows carry `template_id` only; the
// phase/title/required/sort data lives on the template catalog, so this file
// performs the in-memory join (same seam as `rosterBuilder`) and returns the
// task set grouped into the canonical phase order. No I/O and no React — the
// workspace hook feeds it real rows.

export interface WorkspaceTaskItem {
  taskId: number;
  label: string;
  phase: string;
  ownerRole: OnboardingOwnerRole;
  ownerUserId: number | null;
  status: OnboardingTaskStatus;
  dueDate: string | null;
  required: boolean;
  satisfied: boolean;
  notes: string | null;
}

export interface WorkspacePhaseGroup {
  phase: string;
  label: string;
  items: WorkspaceTaskItem[];
  done: number;
  total: number;
}

/** Tasks with no template row sort last (fail closed), matching rosterBuilder. */
const UNTEMPLATED_SORT_ORDER = Number.MAX_SAFE_INTEGER;

interface EnrichedWorkspaceTask extends WorkspaceTaskItem {
  sortOrder: number;
}

function enrichTask(
  task: OnboardingTask,
  templateById: Map<number, OnboardingTaskTemplate>
): EnrichedWorkspaceTask {
  const template =
    task.template_id === null ? undefined : templateById.get(task.template_id);
  return {
    taskId: task.id,
    label: template?.title ?? `Task #${task.id}`,
    phase: template?.phase ?? "custom",
    ownerRole: task.owner_role,
    ownerUserId: task.owner_user_id,
    status: task.status,
    dueDate: task.due_date,
    // Todo-10 soft-delete rule: an inactive catalog row is never required (the
    // item still renders as informational); a missing template stays required.
    required: template
      ? template.is_active === true && template.is_required === true
      : true,
    satisfied: isTaskSatisfied(task.status),
    notes: task.notes,
    sortOrder: template?.sort_order ?? UNTEMPLATED_SORT_ORDER,
  };
}

/**
 * Joins the employee's task set to the template catalog and groups it by
 * phase in the canonical onboarding order (documents → orientation →
 * training → equipment → extras). A task with no template becomes its own
 * `custom` phase and counts as required so nothing is silently dropped.
 * @param tasks - The employee's `onboarding_task` rows.
 * @param templates - The seeded `onboarding_task_template` catalog.
 * @returns One entry per phase with its ordered items + done/total counts.
 */
export function buildWorkspacePhaseGroups(
  tasks: readonly OnboardingTask[],
  templates: readonly OnboardingTaskTemplate[]
): WorkspacePhaseGroup[] {
  const templateById = new Map(
    templates.map((template) => [template.id, template])
  );
  const enriched = tasks.map((task) => enrichTask(task, templateById));

  const byPhase = new Map<string, EnrichedWorkspaceTask[]>();
  for (const item of enriched) {
    const list = byPhase.get(item.phase);
    if (list) list.push(item);
    else byPhase.set(item.phase, [item]);
  }

  return orderPhases([...byPhase.keys()]).map((phase) => {
    const phaseItems = (byPhase.get(phase) ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.taskId - b.taskId
    );
    const items: WorkspaceTaskItem[] = phaseItems.map((item) => ({
      taskId: item.taskId,
      label: item.label,
      phase: item.phase,
      ownerRole: item.ownerRole,
      ownerUserId: item.ownerUserId,
      status: item.status,
      dueDate: item.dueDate,
      required: item.required,
      satisfied: item.satisfied,
      notes: item.notes,
    }));
    return {
      phase,
      label: phaseLabel(phase),
      items,
      done: items.filter((item) => item.satisfied).length,
      total: items.length,
    };
  });
}
