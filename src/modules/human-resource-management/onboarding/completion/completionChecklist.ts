// completionChecklist.ts — employee + onboarding-task completion (todo 22).
//
// Completion is DERIVED from the employee's `onboarding_task` set: onboarding
// is complete when EVERY required task is satisfied (`done`, or explicitly
// waived as `na`). Nothing here — and nothing in the completion route —
// reads or writes `onboarding_profiles`; there is no profile scope and no
// legacy status vocabulary in this module.
//
// The task rows are the single truth: the four §10 phases (documents /
// orientation / training / equipment) are task phases now, so the old
// per-module evidence readers (profile status machine, equipment catalog,
// orientation store, training rows, acknowledgement namespace) are
// deliberately NOT used anymore — a task not done is a task missing, full
// stop.
//
// Kept below: the frozen onboarding event keys + the profile-era dispatch
// helpers still imported by the verification / training-submit / profile
// routes. Todo 26 retires those callers together with the profile API.

import type { DispatchCtx } from "../../recruitment/mailing/utils/dispatchMail";
import type {
  OnboardingOwnerRole,
  OnboardingTask,
  OnboardingTaskStatus,
  OnboardingTaskTemplate,
} from "../types/onboarding-task.schema";

/** The four owner-sanctioned onboarding event keys (Todo 1c §2 — must match
 *  `FROZEN_EVENT_KEYS` in dispatchMail.ts exactly; the frozen-enum diff
 *  assert in the Todo 14 evidence guards drift). */
export const ONBOARDING_EVENT_KEYS = [
  "onboarding.profile_created",
  "onboarding.docs_verified",
  "onboarding.training_completed",
  "onboarding.completed",
] as const;

export type OnboardingEventKey = (typeof ONBOARDING_EVENT_KEYS)[number];

// ---------------------------------------------------------------------------
// Profile-era notification helpers — STILL LIVE for the profile routes owned
// by todos 20/23/24. They are shape-only (they never read or write a profile
// row); todo 26 deletes them with their callers.
// ---------------------------------------------------------------------------

/** @deprecated Profile-era dispatch shape — only the three profile-driven
 *  notification call sites use it. Trimmed to the fields the dispatch
 *  context actually reads (no status vocabulary). */
export interface CompletionProfileLike {
  id: number;
  employee_id: number;
  application_id: number | null;
}

/**
 * Dedup key for onboarding notifications: `<entity_id>:<transition>`
 * (e.g. `42:onboarding.completed`). Passed as the explicit
 * `idempotency_key` so a re-fire collapses to `duplicate` — exactly one
 * notification per transition, mirroring dispatchMail's duplicate-key path.
 */
export function buildCompletionDedupKey(
  entityId: number,
  transition: OnboardingEventKey
): string {
  return `${entityId}:${transition}`;
}

/**
 * Builds the dispatch context for a profile-driven onboarding transition.
 * The `application_id` bridge resolves HR-explicit first; when the hire has
 * no bridge the synthetic `onboarding:<profileId>` id is used — it can never
 * equal a numeric `application` row id, so recipient lookup deterministically
 * misses and dispatch records `skipped` (never a wrong-person send), still
 * under the same dedup key.
 */
export function buildOnboardingDispatchCtx(
  profile: Pick<CompletionProfileLike, "id" | "employee_id" | "application_id">,
  eventKey: OnboardingEventKey,
  status: string
): DispatchCtx {
  const bridge =
    typeof profile.application_id === "number" && profile.application_id > 0
      ? profile.application_id
      : `onboarding:${profile.id}`;
  return {
    event_key: eventKey,
    application_id: bridge,
    vars: {
      profile_id: String(profile.id),
      employee_id: String(profile.employee_id),
      status,
    },
    idempotency_key: buildCompletionDedupKey(profile.id, eventKey),
  };
}

// ---------------------------------------------------------------------------
// Task-backed completion (the only checklist this module knows)
// ---------------------------------------------------------------------------

export interface CompletionInputs {
  /** The employee's `onboarding_task` rows (any order; sorted here). */
  tasks: readonly OnboardingTask[];
  /** The task catalog — supplies title / phase / is_required / sort_order. */
  templates: readonly OnboardingTaskTemplate[];
}

export interface ChecklistItem {
  /** Stable key for the UI: `task:<onboarding_task.id>`. */
  key: string;
  taskId: number;
  templateId: number | null;
  label: string;
  phase: string;
  ownerRole: OnboardingOwnerRole;
  status: OnboardingTaskStatus;
  dueDate: string | null;
  required: boolean;
  done: boolean;
  detail: string;
}

/**
 * A task is satisfied when it is `done` (the completion route's own action)
 * or explicitly waived as `na` ("not applicable" is an HR decision, not a
 * pending state). Required tasks block completion until satisfied; optional
 * tasks never block.
 * @param status - Stored `onboarding_task.status`.
 * @returns True when the task no longer blocks completion.
 */
export function isTaskSatisfied(status: OnboardingTaskStatus): boolean {
  return status === "done" || status === "na";
}

/** Tasks with no template row are treated as required (fail closed — an
 *  obligation exists without evidence it was optional). */
const UNTEMPLATED_SORT_ORDER = Number.MAX_SAFE_INTEGER;

/**
 * Runs the task checklist: one item per task, joined to its template for
 * label / phase / required / order. Pure — the caller supplies real rows;
 * nothing here fetches or writes.
 * @param input - The employee's tasks + the template catalog.
 * @returns Checklist items sorted by template sort order, then task id.
 */
export function runCompletionChecklist(input: CompletionInputs): ChecklistItem[] {
  const byTemplate = new Map(input.templates.map((template) => [template.id, template]));

  const items = input.tasks.map((task): ChecklistItem => {
    const template =
      task.template_id === null ? undefined : byTemplate.get(task.template_id);
    // Todo-10 soft-delete rule: an INACTIVE catalog row is never required (its
    // item may still render as informational); a missing template stays
    // required (fail closed). Existing task rows are never mutated here.
    const required = template
      ? template.is_active === true && template.is_required === true
      : true;
    const phase = template?.phase ?? "custom";
    const label = template?.title ?? `Task #${task.id}`;
    const done = isTaskSatisfied(task.status);
    const scope = required ? "Required" : "Optional";
    const state = done
      ? task.status === "na"
        ? "waived (na)"
        : "done"
      : `status ${task.status}`;
    const due = task.due_date !== null ? ` · due ${task.due_date}` : "";

    return {
      key: `task:${task.id}`,
      taskId: task.id,
      templateId: task.template_id,
      label,
      phase,
      ownerRole: task.owner_role,
      status: task.status,
      dueDate: task.due_date,
      required,
      done,
      detail: `${scope} · ${phase} · owner ${task.owner_role} · ${state}${due}`,
    };
  });

  items.sort((a, b) => {
    const aTemplate = a.templateId === null ? undefined : byTemplate.get(a.templateId);
    const bTemplate = b.templateId === null ? undefined : byTemplate.get(b.templateId);
    const aOrder = aTemplate?.sort_order ?? UNTEMPLATED_SORT_ORDER;
    const bOrder = bTemplate?.sort_order ?? UNTEMPLATED_SORT_ORDER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.taskId - b.taskId;
  });

  return items;
}

/** Required tasks still blocking completion, in checklist order (the
 *  refuse-with-list payload). Optional tasks never appear here. */
export function missingChecklistItems(
  items: readonly ChecklistItem[]
): ChecklistItem[] {
  return items.filter((item) => item.required && !item.done);
}

/**
 * True iff the employee has at least one required task AND every required
 * task is satisfied. An employee with zero required tasks (nothing
 * materialized, or an empty catalog) is NEVER complete — the same empty-set
 * guard the signing completion predicate uses, so a missing task set can
 * never read as a misleading "complete".
 */
export function isCompletionReady(items: readonly ChecklistItem[]): boolean {
  const required = items.filter((item) => item.required);
  return required.length > 0 && required.every((item) => item.done);
}

/**
 * Builds the dispatch context for the employee's `onboarding.completed`
 * notification. The bridge is synthetic (`onboarding-user:<id>`) because
 * there is no applicant<->user link by design: when the employee has an
 * email it is passed as the explicit `to_email` override; otherwise the
 * recipient lookup deterministically misses and dispatch records `skipped`
 * (never a wrong-person send), still under the employee-scoped dedup key.
 * @param input - Employee id + resolved email (null when absent).
 * @returns Dispatch context for the frozen `onboarding.completed` event.
 */
export function buildEmployeeCompletionDispatchCtx(input: {
  userId: number;
  toEmail: string | null;
}): DispatchCtx {
  const ctx: DispatchCtx = {
    event_key: "onboarding.completed",
    application_id: `onboarding-user:${input.userId}`,
    vars: {
      user_id: String(input.userId),
      employee_id: String(input.userId),
      status: "complete",
    },
    idempotency_key: buildCompletionDedupKey(input.userId, "onboarding.completed"),
  };
  const email = input.toEmail?.trim();
  if (email) ctx.to_email = email;
  return ctx;
}
