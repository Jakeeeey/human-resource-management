import { runHireOrchestrator } from "@/modules/human-resource-management/onboarding/hire/server/hire-orchestrator";
import {
  readHireApplicant,
  readHireApplicationByApplicant,
  resolveHireEmail,
  resolveHirePosition,
} from "@/modules/human-resource-management/onboarding/hire/server/hire-application";
import {
  getApplicantStatus,
  setApplicantStatus,
  type ApplicantStatus,
} from "@/modules/human-resource-management/shared/services/applicant-status-service";
import type {
  JobOffer,
  SigningCompletion,
} from "@/modules/human-resource-management/onboarding/signing/types/contracts";

import { canSigningSetFireHired } from "./signing-set-service";

// signingHireCommit.ts — THE completion commitment step (todo 15 + todo 16).
//
// Called from `recomputeSigningRollups` (the todo-12 rollup path) after both
// rollup writes. When the todo-10 completion predicate holds it:
//   1. GATES on the hire prerequisites (linked application + usable email +
//      position) BEFORE any applicant write — a set signed against an
//      application with no email must never leave the applicant terminal
//      `hired` without an employee (the S5 wedge);
//   2. flips the applicant to `hired` via the SINGLE status writer;
//   3. runs the todo-16 post-hire orchestrator in the SAME call.
//
// Outcomes are RETURNED (never thrown past the rollup) as a
// `SigningCompletion` discriminated union so the route/UI can show
// "envelope complete" and "hire finalized" as distinct states and offer a
// retry. A retry re-observes `hired` (same-status no-op) and re-runs the
// orchestrator, which reuses the existing user (resume-safe).

export interface FireHiredIfCompleteInput {
  applicantId: number;
  offerStatus: JobOffer["status"];
  requiredCount: number;
  signedCount: number;
}

export interface FireHiredIfCompleteResult {
  /** `"hired"` when the transition fired/re-observed; else null. */
  applicantStatus: ApplicantStatus | null;
  completion: SigningCompletion;
}

/**
 * Resolves the FIRST missing hire prerequisite, or null when the
 * orchestrator has everything it needs (application row, email, position).
 * Read-only — the caller writes nothing when this answers non-null.
 *
 * Exported so the read-only completion PREVIEW route
 * (`/api/hrm/onboarding/signing-envelope/completion`) can name the missing
 * prerequisite on a cold load of a completed-but-blocked set, instead of
 * showing the generic "completion pending" copy until the user retries
 * (S5 re-QA finding N1). The preview route performs ZERO writes.
 * @param applicantId - Applicant row id.
 * @returns The first missing prerequisite reason, or null when satisfied.
 * @throws Error when the prerequisite reads themselves fail.
 */
export async function readMissingHirePrerequisite(
  applicantId: number
): Promise<string | null> {
  const applicant = await readHireApplicant(applicantId);
  if (!applicant) return "the applicant record could not be read";
  const application = await readHireApplicationByApplicant(applicantId);
  if (!application) return "the applicant has no linked application record";
  if (!resolveHireEmail(application)) {
    return `application #${application.id} has no email address`;
  }
  if (!resolveHirePosition(application, applicant)) {
    return `application #${application.id} has no job position`;
  }
  return null;
}

/**
 * Commits a completed signing set: gates the hire prerequisites, fires
 * `hired` when they hold, and immediately runs the employee-creation
 * orchestrator.
 * @param input - Applicant id + offer status + required/signed counts.
 * @returns The applicant status this call produced (null while incomplete /
 * gated) and the typed completion outcome. A gated call performs ZERO writes.
 * @throws Error only when the applicant status transition itself is
 * disallowed (terminal applicant) or a prerequisite read fails; orchestrator
 * failures are reported as `completion.kind = "failed"` (already audited in
 * Directus `activity_logs`).
 */
export async function fireHiredIfComplete(
  input: FireHiredIfCompleteInput
): Promise<FireHiredIfCompleteResult> {
  if (!canSigningSetFireHired(input)) {
    return { applicantStatus: null, completion: { kind: "incomplete" } };
  }

  // RESUME PATH: an applicant already `hired` skips the gate (the original
  // commit validated the prerequisites) and only re-runs the idempotent
  // orchestrator — a retry must never be blocked by data that changed after
  // the hire was committed.
  const currentStatus = await getApplicantStatus(input.applicantId);
  if (currentStatus !== "hired") {
    const missing = await readMissingHirePrerequisite(input.applicantId);
    if (missing !== null) {
      return {
        applicantStatus: null,
        completion: { kind: "blocked", reason: missing },
      };
    }
  }

  const applicant = await setApplicantStatus({
    applicantId: input.applicantId,
    status: "hired",
  });
  if (applicant.status !== "hired") {
    return {
      applicantStatus: applicant.status,
      completion: { kind: "incomplete" },
    };
  }

  try {
    const outcome = await runHireOrchestrator({
      applicantId: input.applicantId,
    });
    return {
      applicantStatus: applicant.status,
      completion: { kind: "hired", userCreated: outcome.userCreated },
    };
  } catch (error) {
    return {
      applicantStatus: applicant.status,
      completion: {
        kind: "failed",
        reason: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
