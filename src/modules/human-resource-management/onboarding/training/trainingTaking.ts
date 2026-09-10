import type {
  TrainingActor,
  TrainingTakingAssignment,
} from "./types/training-taking.schema";

// trainingTaking.ts — server-safe ownership + row helpers for Todo 12.
//
// Everything here is principal plumbing and row normalization. There is NO
// scoring, percentage, or pass/fail math in this file — grading stays inside
// the untouched engine (`gradeAnswers`); display scalars are read off the
// real `GradeResult` via the Todo 4 adapter's `buildCompletionScalars`.

export interface AssignmentOwner {
  employee_id: number;
  profile_id: number;
}

export type OwnerVerdict =
  | { ok: true }
  | { ok: false; status: 403; error: string };

/**
 * IDOR gate: a `hiree` actor may touch ONLY the assignment whose
 * `employee_id` AND `profile_id` both match the actor. `hr` actors bypass
 * (HR override, logged by the caller). Both ids must match — matching only
 * one still yields 403.
 */
export function assertAssignmentOwner(
  assignment: AssignmentOwner,
  actor: TrainingActor
): OwnerVerdict {
  if (actor.role === "hr") return { ok: true };
  if (
    actor.employee_id === assignment.employee_id &&
    actor.profile_id === assignment.profile_id
  ) {
    return { ok: true };
  }
  return {
    ok: false,
    status: 403,
    error: "You can only take your own training assignment",
  };
}

/**
 * Normalizes a Directus `training_assignments` row to the taking shape.
 * All audit/date columns are nullable app-written values (zero DB defaults).
 */
export function normalizeTrainingAssignment(
  row: Record<string, unknown>
): TrainingTakingAssignment {
  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isInteger(v) ? v : null;
  const strOrNull = (v: unknown): string | null =>
    typeof v === "string" ? v : v === null || v === undefined ? null : String(v);
  const status = row["status"];
  return {
    id: Number(row["id"]),
    profile_id: Number(row["profile_id"]),
    employee_id: Number(row["employee_id"]),
    quiz_id: Number(row["quiz_id"]),
    application_id: numOrNull(row["application_id"]),
    due: strOrNull(row["due"]),
    opened_at: strOrNull(row["opened_at"]),
    status:
      status === "assigned" || status === "in_progress" || status === "completed"
        ? status
        : "assigned",
    completed_ref: numOrNull(row["completed_ref"]),
    created_at: strOrNull(row["created_at"]),
    created_by: numOrNull(row["created_by"]),
    updated_at: strOrNull(row["updated_at"]),
    updated_by: numOrNull(row["updated_by"]),
  };
}

/**
 * Engine-applicant bridge: reads the hire's REAL applicant id off the
 * Directus `application` row (`application.applicant_id`). Returns `null`
 * when the row is missing or the link is absent — the submit route then
 * refuses completion with reason instead of fabricating an applicant id.
 */
export function resolveEngineApplicant(
  applicationRow: Record<string, unknown> | null
): number | null {
  if (!applicationRow) return null;
  const value = applicationRow["applicant_id"];
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

export function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}
