import { z } from "zod";

import type {
  OnboardingTask,
  OnboardingTaskTemplate,
} from "../../types/onboarding-task.schema";
import {
  parseDocRefEmployeeId,
  type AcknowledgementLog,
} from "./acknowledgement-log.schema";

// verification-queue.schema.ts — queue read model + decision mutation contract.
//
// Verification is EMPLOYEE-keyed now: the queue is a VIEW over the employee's
// `documents`-phase `onboarding_task` rows (todo 19 engine). There is no
// `onboarding_profiles` read and no legacy status vocabulary anywhere on this
// path — the retired profile statuses gate nothing.
//
// Task mapping (the codes are the seeded catalog's `documents` rows):
// - `documents_submitted` (hiree)      done    -> the row ENTERS the queue;
// - `documents_hr_verified` (hr)       pending -> pending
//                                      blocked -> returned (+ reason in notes)
//                                      done    -> approved (history)
// Cycle: pending → approved | returned(reason) → resubmit → pending → approved.
// Approve from returned is refused (resubmit first) so the cycle is provable.
//
// The acknowledgement audit trail stays a SEPARATE store keyed by the doc_ref
// convention `onboarding:employee:<user_id>` (acknowledgement-log.schema.ts).

export const VERIFICATION_PHASE = "documents";
export const DOCUMENTS_SUBMITTED_CODE = "documents_submitted";
export const DOCUMENTS_HR_VERIFIED_CODE = "documents_hr_verified";

// Return reasons persist in `onboarding_task.notes` (TEXT). The 41-char cap is
// carried over from the profile-era `current_stage` marker budget so the
// dialog + route contracts stay behavior-equivalent across the re-key.
export const MAX_RETURN_REASON_LENGTH = 41;

export type QueueState = "pending" | "returned" | "approved";

/** One hiree-uploaded portal document filed for the employee. */
export interface QueueDocument {
  /** Portal doc slot (e.g. `valid_id`) — the marker's `<doc_key>`. */
  docKey: string;
  /** Human title from `PORTAL_DOC_CONFIG` (falls back to the raw key). */
  title: string;
  /** Directus file UUID (marker description `onboarding-portal:employee:<id>:<key>`). */
  fileId: string;
}

export interface QueueRow {
  /** Employee key (`user.user_id`) — the only scope on this queue. */
  userId: number;
  queueState: QueueState;
  returnReason: string | null;
  ackCount: number;
  lastAcknowledgedAt: string | null;
  /** Latest change across the two documents tasks. */
  updatedAt: string | null;
  /** Hiree-uploaded portal documents for this employee (empty = none). */
  documents: QueueDocument[];
}

export interface QueueAggregate {
  rows: QueueRow[];
  counts: Record<QueueState, number>;
}

export const VERIFICATION_DECISIONS = ["approve", "return", "resubmit"] as const;

export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];

// POST body: exactly one decision per call. `return` requires a reason;
// approve/resubmit carry none. `user_id` targets the employee's documents
// task pair — never a profile.
export const VerificationDecisionSchema = z
  .object({
    user_id: z.number().int().positive(),
    decision: z.enum(VERIFICATION_DECISIONS),
    reason: z.string().min(1).max(MAX_RETURN_REASON_LENGTH).optional(),
  })
  .strict()
  .refine((d) => d.decision !== "return" || (d.reason ?? "").trim().length > 0, {
    message: "A return reason is required when returning for resubmit",
    path: ["reason"],
  });

export type VerificationDecisionInput = z.infer<
  typeof VerificationDecisionSchema
>;

export interface VerificationQueueResponse {
  success: boolean;
  data?: QueueAggregate | QueueRow | null;
  message?: string;
}

export interface VerificationTasks {
  /** `documents_submitted` task — the hiree's submit step (queue gate). */
  submitted: OnboardingTask | null;
  /** `documents_hr_verified` task — the target of every HR decision. */
  hr: OnboardingTask | null;
}

// Resolves the two verification tasks from the seeded catalog codes. Tasks
// whose template is not a documents-phase row are ignored.
export function findVerificationTasks(
  tasks: readonly OnboardingTask[],
  templates: readonly OnboardingTaskTemplate[]
): VerificationTasks {
  const codeById = new Map<number, string>();
  for (const template of templates) {
    if (template.phase === VERIFICATION_PHASE) {
      codeById.set(template.id, template.code);
    }
  }
  let submitted: OnboardingTask | null = null;
  let hr: OnboardingTask | null = null;
  for (const task of tasks) {
    if (task.template_id === null) continue;
    const code = codeById.get(task.template_id);
    if (code === DOCUMENTS_SUBMITTED_CODE) submitted = task;
    else if (code === DOCUMENTS_HR_VERIFIED_CODE) hr = task;
  }
  return { submitted, hr };
}

// Queue state of one employee: the HR task decides first (done -> approved,
// blocked -> returned); a submitted-but-unverified row is pending; anything
// else is NOT in the queue.
export function deriveQueueState(tasks: VerificationTasks): QueueState | null {
  if (tasks.hr?.status === "done") return "approved";
  if (tasks.hr?.status === "blocked") return "returned";
  return tasks.submitted?.status === "done" ? "pending" : null;
}

// The return reason lives in the blocked HR task's notes; empty notes read as
// null (a marker without a reason never renders as blank evidence).
function blockedReason(task: OnboardingTask | null): string | null {
  if (!task || task.status !== "blocked") return null;
  const clean = (task.notes ?? "").trim();
  return clean.length > 0 ? clean : null;
}

// ISO-ish Directus timestamps sort lexicographically — max = latest change.
function latestTimestamp(...values: readonly (string | null)[]): string | null {
  const times = values.filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  if (times.length === 0) return null;
  return times.reduce((a, b) => (a > b ? a : b));
}

// Builds one queue row from an employee's tasks + the shared catalog + the ack
// logs. Returns null when the employee is not in verification (no submitted
// gate passed and no HR decision recorded). Pure — the caller supplies rows.
export function buildQueueRow(
  userId: number,
  tasks: readonly OnboardingTask[],
  templates: readonly OnboardingTaskTemplate[],
  logs: readonly AcknowledgementLog[],
  documents: readonly QueueDocument[] = []
): QueueRow | null {
  const pair = findVerificationTasks(tasks, templates);
  const queueState = deriveQueueState(pair);
  if (queueState === null) return null;

  const entries = logs.filter(
    (log) => parseDocRefEmployeeId((log.doc_ref ?? "").trim()) === userId
  );
  const times = entries
    .map((entry) => entry.acknowledged_at)
    .filter((time): time is string => typeof time === "string" && time.length > 0)
    .sort();

  return {
    userId,
    queueState,
    returnReason: blockedReason(pair.hr),
    ackCount: entries.length,
    lastAcknowledgedAt: times.length > 0 ? times[times.length - 1] : null,
    updatedAt: latestTimestamp(
      pair.hr?.updated_at ?? null,
      pair.submitted?.updated_at ?? null
    ),
    documents: [...documents],
  };
}

// Joins the ack-log rows onto every employee that owns documents tasks for
// the queue read. Pure — shared by the route and the harness.
export function aggregateQueue(
  tasks: readonly OnboardingTask[],
  templates: readonly OnboardingTaskTemplate[],
  logs: readonly AcknowledgementLog[],
  documentsByUser: ReadonlyMap<number, readonly QueueDocument[]> = new Map()
): QueueAggregate {
  const userIds = [...new Set(tasks.map((task) => task.user_id))].sort(
    (a, b) => a - b
  );
  const rows: QueueRow[] = [];
  for (const userId of userIds) {
    const row = buildQueueRow(
      userId,
      tasks,
      templates,
      logs,
      documentsByUser.get(userId) ?? []
    );
    if (row) rows.push(row);
  }

  const counts: Record<QueueState, number> = {
    pending: 0,
    returned: 0,
    approved: 0,
  };
  for (const row of rows) counts[row.queueState] += 1;
  return { rows, counts };
}
