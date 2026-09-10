import type { OnboardingOwnerRole } from "@/modules/human-resource-management/onboarding/types/onboarding-task.schema";

import { isDateOverdue } from "./rosterData";
import type { WorkspacePhaseGroup, WorkspaceTaskItem } from "./workspaceTasks";

// taskInbox.ts — the role-scoped "My tasks / needs attention" projection for
// the per-hire workspace (todo 29). ONE input, TWO views: the phased list
// (`workspaceTasks.ts`) and this inbox both read the SAME
// `WorkspacePhaseGroup[]` slice produced from the single `onboarding_task`
// fetch — no second query and no client-side copy of task state.
//
// Ownership is the real stored attribution (`owner_user_id`, else the task's
// `owner_role`). The operator arrives resolved from the server session
// (`operatorIdentity.ts`); there is NO "acting role" input here, so the inbox
// can only ever show the operator's own work — never another owner's under a
// borrowed role.

export interface WorkspaceOperator {
  /** Real session user id (`vos_access_token` `sub`); null when unknown. */
  userId: number | null;
  /** The operator's real owner role on this surface (HR onboarding hub). */
  role: OnboardingOwnerRole;
}

/**
 * A task belongs to the operator when it is explicitly assigned to them, or —
 * when unassigned — when it is owned by the operator's role. An explicitly
 * assigned task never appears in another role's inbox, so the role-scoped view
 * cannot impersonate a colleague.
 * @param item - One enriched task row (joined to its template).
 * @param operator - The resolved server session operator.
 * @returns True when this task is the operator's to act on.
 */
export function isTaskOwnedByOperator(
  item: WorkspaceTaskItem,
  operator: WorkspaceOperator
): boolean {
  if (item.ownerUserId !== null) return item.ownerUserId === operator.userId;
  return item.ownerRole === operator.role;
}

/** Flattens the phase groups back into one task list (same objects, no copy). */
export function flattenWorkspaceTasks(
  groups: readonly WorkspacePhaseGroup[]
): WorkspaceTaskItem[] {
  return groups.flatMap((group) => group.items);
}

/** Blocked first, then overdue, then everything else still pending. */
function needsAttentionRank(item: WorkspaceTaskItem, now: Date): number {
  if (item.status === "blocked") return 0;
  if (isDateOverdue(item.dueDate, now)) return 1;
  return 2;
}

/**
 * Projects the shared task set down to the operator's OPEN owned tasks — the
 * "needs attention" inbox. Satisfied tasks (`done`/`na`) drop out because they
 * no longer need anyone; blockers and overdue work sort first.
 * @param groups - The workspace's single `onboarding_task` source.
 * @param operator - The resolved server session operator.
 * @param now - Injectable clock for deterministic tests.
 * @returns The operator's outstanding tasks, most urgent first.
 */
export function buildNeedsAttention(
  groups: readonly WorkspacePhaseGroup[],
  operator: WorkspaceOperator,
  now: Date = new Date()
): WorkspaceTaskItem[] {
  return flattenWorkspaceTasks(groups)
    .filter((item) => !item.satisfied && isTaskOwnedByOperator(item, operator))
    .sort((a, b) => {
      const rank = needsAttentionRank(a, now) - needsAttentionRank(b, now);
      if (rank !== 0) return rank;
      const byDue = (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
      if (byDue !== 0) return byDue;
      return a.taskId - b.taskId;
    });
}
