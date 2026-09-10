import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import { philippineTime } from "./hire-time";

// hire-log.ts — audit writer for the post-hire orchestrator (todo 16).
//
// The orchestrator records EVERY run's outcome in Directus `activity_logs`
// (the live system audit collection): the action is `CREATE_USER` (the only
// user-mutation value in the live enum set alongside UPDATE_USER/DELETE_USER)
// and `status` carries the outcome (`SUCCESS` / `FAILED` are live-proven
// enum members). `reason` carries the machine-readable detail. This module
// NEVER throws — auditing must not break the hire transaction; a failed log
// write degrades to `console.error` and the caller continues.

/** Live-proven `activity_logs.type` member for employee-creation events. */
export const HIRE_ACTIVITY_TYPE = "CREATE_USER";

export interface HireActivityLogEntry {
  /** Resolved employee id; null while the user could not be resolved. */
  userId: number | null;
  userName: string;
  userEmail: string;
  /** true -> SUCCESS, false -> FAILED (both live enum members). */
  ok: boolean;
  reason: string;
}

/**
 * Placeholder for the NOT NULL `activity_logs.user_email` column when the
 * applicant has no email/application yet. Clearly synthetic, never a real
 * address (`.invalid` is the RFC 2606 reserved TLD).
 * @param applicantId - Applicant row id.
 * @returns A synthetic, obviously-unroutable email for audit rows only.
 */
export function placeholderApplicantEmail(applicantId: number): string {
  return `applicant-${applicantId}@no-email.invalid`;
}

/**
 * Appends one hire-orchestrator outcome row to Directus `activity_logs`.
 * Best-effort by contract: resolves even when Directus rejects the write
 * (errors are logged, never rethrown).
 * @param entry - Audit entry (resolved ids + stable reason string).
 */
export async function logHireActivity(entry: HireActivityLogEntry): Promise<void> {
  try {
    const body: unknown = await dFetch("/items/activity_logs", {
      method: "POST",
      body: JSON.stringify({
        id: crypto.randomUUID(),
        user_id: entry.userId,
        user_name: entry.userName,
        user_email: entry.userEmail,
        type: HIRE_ACTIVITY_TYPE,
        status: entry.ok ? "SUCCESS" : "FAILED",
        timestamp: philippineTime(),
        reason: entry.reason,
      }),
    });
    if (
      typeof body === "object" &&
      body !== null &&
      "errors" in body &&
      Array.isArray((body as { errors?: unknown }).errors)
    ) {
      console.error(
        "[hire-orchestrator] activity log rejected:",
        JSON.stringify(body)
      );
    }
  } catch (error) {
    console.error("[hire-orchestrator] activity log write failed:", error);
  }
}
