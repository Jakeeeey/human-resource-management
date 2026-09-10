import { runHireOrchestrator } from "@/modules/human-resource-management/onboarding/hire/server/hire-orchestrator";
import {
  setApplicantStatus,
  type ApplicantStatus,
} from "@/modules/human-resource-management/shared/services/applicant-status-service";
import type { JobOffer } from "@/modules/human-resource-management/onboarding/signing/types/contracts";

import { canSigningSetFireHired } from "./signing-set-service";

// signingHireCommit.ts — THE completion commitment step (todo 15 + todo 16).
//
// Called from `recomputeSigningRollups` (the todo-12 rollup path) after both
// rollup writes. When the todo-10 completion predicate holds it:
//   1. flips the applicant to `hired` via the SINGLE status writer;
//   2. runs the todo-16 post-hire orchestrator in the SAME call, passing the
//      applicant id — the orchestrator resolves/creates the Spring user
//      (idempotent by email) and drives every registered post-hire step.
// A retry re-observes `hired` (same-status no-op) and re-runs the
// orchestrator, which reuses the existing user (resume-safe).

export interface FireHiredIfCompleteInput {
  applicantId: number;
  offerStatus: JobOffer["status"];
  requiredCount: number;
  signedCount: number;
}

/**
 * Commits a completed signing set: fires `hired` when the predicate holds and
 * immediately runs the employee-creation orchestrator.
 * @param input - Applicant id + offer status + required/signed counts.
 * @returns `"hired"` when the transition fired/re-observed; `null` when the
 * set is not complete (predicate false — no applicant write, no employee).
 * @throws Error when the status transition is disallowed (terminal applicant)
 * or the orchestrator fails; the orchestrator records the failure in
 * Directus `activity_logs` before rethrowing.
 */
export async function fireHiredIfComplete(
  input: FireHiredIfCompleteInput
): Promise<ApplicantStatus | null> {
  if (!canSigningSetFireHired(input)) return null;

  const applicant = await setApplicantStatus({
    applicantId: input.applicantId,
    status: "hired",
  });
  if (applicant.status === "hired") {
    await runHireOrchestrator({ applicantId: input.applicantId });
  }
  return applicant.status;
}
