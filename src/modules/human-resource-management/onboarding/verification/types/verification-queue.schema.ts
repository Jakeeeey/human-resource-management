import { z } from "zod";

import type { OnboardingProfile } from "../../hub/types/onboarding-profile.schema";
import type { AcknowledgementLog } from "./acknowledgement-log.schema";

// verification-queue.schema.ts — queue read model + decision mutation contract.
//
// Queue states persist on `onboarding_profiles` with ZERO schema changes:
// - pending: status DOCUMENTS_SUBMITTED, no return marker.
// - returned: status DOCUMENTS_SUBMITTED + current_stage RETURNED marker.
// - approved: status HR_VERIFIED (history; marker wiped by status mirror).
// Cycle: pending → approved | returned(reason) → resubmit → pending → approved.
// Approve from returned is refused (resubmit first) so the cycle is provable.
//
// The DOCUMENTS_SUBMITTED done-predicate is owned here (statusMachine defers
// it to Todo 10): the HR approve decision IS the verification evidence. The
// verifications POST route machine-checks with documentsVerified:true, then
// PATCHes via dFetch — Todo 5 schema/routes stay frozen.

export const RETURNED_STAGE_PREFIX = "RETURNED";

// DB-derived budget: `onboarding_profiles.current_stage` is VARCHAR(50), so
// `RETURNED|<reason>` caps the reason at 50 − 9 = 41 chars (VALUE_TOO_LONG
// asserted live). HR writes concise reasons; the dialog enforces this max.
export const MAX_RETURN_REASON_LENGTH = 41;

export type QueueState = "pending" | "returned" | "approved";

export interface QueueRow {
  profile: OnboardingProfile;
  queueState: QueueState;
  returnReason: string | null;
  ackCount: number;
  lastAcknowledgedAt: string | null;
}

export interface QueueAggregate {
  rows: QueueRow[];
  counts: Record<QueueState, number>;
}

// Builds the current_stage return marker. Reason is trimmed + capped so the
// marker stays a short pointer (never a freeform essay field).
export function buildReturnMarker(reason: string): string {
  const clean = reason.trim().slice(0, MAX_RETURN_REASON_LENGTH).trim();
  return `${RETURNED_STAGE_PREFIX}|${clean}`;
}

export interface ReturnMarker {
  returned: boolean;
  reason: string | null;
}

// Parses current_stage: marker present → returned + reason, else not returned.
export function parseReturnMarker(
  currentStage: string | null | undefined
): ReturnMarker {
  if (!currentStage || !currentStage.startsWith(`${RETURNED_STAGE_PREFIX}|`)) {
    return { returned: false, reason: null };
  }
  const reason = currentStage.slice(RETURNED_STAGE_PREFIX.length + 1).trim();
  return { returned: true, reason: reason.length > 0 ? reason : null };
}

// Derives the queue state of a profile row (call only for verification-stage
// statuses; other statuses map to approved-history when HR_VERIFIED).
export function deriveQueueState(
  status: string,
  currentStage: string | null | undefined
): QueueState {
  if (status === "HR_VERIFIED") return "approved";
  return parseReturnMarker(currentStage).returned ? "returned" : "pending";
}

export const VERIFICATION_DECISIONS = ["approve", "return", "resubmit"] as const;

export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];

// POST body: exactly one decision per call. `return` requires a reason;
// approve/resubmit carry none. profile_id targets DOCUMENTS_SUBMITTED rows.
export const VerificationDecisionSchema = z
  .object({
    profile_id: z.number().int().positive(),
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
  data?: QueueAggregate | OnboardingProfile | null;
  message?: string;
}

// Joins ack-log rows onto verification-stage profiles for the queue read:
// per-recipient status port (count + last-ack per profile, keyed by the
// doc_ref convention). Pure — shared by the route and the harness.
export function aggregateQueue(
  profiles: OnboardingProfile[],
  logs: AcknowledgementLog[]
): QueueAggregate {
  const byProfile = new Map<number, AcknowledgementLog[]>();
  for (const log of logs) {
    const match = /^onboarding:profile:(\d+)(?::.*)?$/.exec(
      (log.doc_ref ?? "").trim()
    );
    if (!match) continue;
    const id = Number(match[1]);
    if (!Number.isInteger(id) || id <= 0) continue;
    const list = byProfile.get(id) ?? [];
    list.push(log);
    byProfile.set(id, list);
  }

  const rows: QueueRow[] = profiles.map((profile) => {
    const marker = parseReturnMarker(profile.current_stage);
    const queueState = deriveQueueState(profile.status, profile.current_stage);
    const entries = byProfile.get(profile.id) ?? [];
    const times = entries
      .map((e) => e.acknowledged_at)
      .filter((t): t is string => typeof t === "string" && t.length > 0)
      .sort();
    return {
      profile,
      queueState,
      returnReason: marker.returned ? marker.reason : null,
      ackCount: entries.length,
      lastAcknowledgedAt: times.length > 0 ? times[times.length - 1] : null,
    };
  });

  const counts: Record<QueueState, number> = {
    pending: 0,
    returned: 0,
    approved: 0,
  };
  for (const row of rows) counts[row.queueState] += 1;
  return { rows, counts };
}
