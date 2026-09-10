import {
  HIRE_ORCHESTRATOR_ERROR_CODES,
  HireOrchestrationInputSchema,
  type HireCompletionContext,
  type HireCompletionStepResult,
  type HireOrchestrationResult,
} from "../types/hire.schema";
import {
  buildSpringUserPayload,
  readHireApplicant,
  readHireApplicationByApplicant,
  resolveHireEmail,
  resolveHirePosition,
} from "./hire-application";
import { logHireActivity, placeholderApplicantEmail } from "./hire-log";
import { listHireCompletionSteps } from "./hire-steps";
import { resolveHireUser } from "./hire-user";

// hire-orchestrator.ts — THE single post-hire completion orchestrator (todo 16).
//
// Triggered when todo 15 flips `applicant.status` to `hired` (the completion
// branch of the signing rollup service calls `fireHiredIfComplete`, which
// calls this function). It runs the post-hire effects in order, idempotently:
//
//   1. read the applicant + its linked application (the prefill source);
//   2. resolve/create the Spring `user` by the applicant's email — reuse wins,
//      concurrent duplicates collapse to one create (hire-user.ts);
//   3. run every registered post-hire step with the resolved `user_id` — the
//      todos 17/19 SEAM (hire-steps.ts). Steps receive `{ applicantId,
//      applicationId, userId, userCreated, email }`; `userId` IS the
//      correlation, so NO applicant↔user / offer↔user DB column exists;
//   4. record the outcome in Directus `activity_logs` (success AND failure).
//
// FAILURE MODEL: any failure is recorded (status FAILED + reason) and then
// rethrown so the signing route surfaces it (500) and a retry can heal:
// the user is reused by email, the applicant stays `hired` either way.

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runHireSteps(
  context: HireCompletionContext
): Promise<HireCompletionStepResult[]> {
  const results: HireCompletionStepResult[] = [];
  for (const step of listHireCompletionSteps()) {
    try {
      results.push(await step(context));
    } catch (error) {
      results.push({
        step: step.name || "post-hire-step",
        ok: false,
        detail: toMessage(error),
      });
    }
  }
  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.stepFailed}: ${failed
        .map((result) => `${result.step} (${result.detail ?? "no detail"})`)
        .join("; ")}`
    );
  }
  return results;
}

/**
 * Runs the post-hire completion for one applicant. Call ONLY after the
 * applicant transitioned to `hired` (the orchestrator re-checks and refuses
 * any other status). Idempotent end to end: retries reuse the user and re-run
 * the idempotent steps; failures are audited before they are rethrown.
 * @param rawInput - `{ applicantId, authToken? }` (strict).
 * @returns The resolved employee id, whether it was created, and the step
 * outcomes.
 * @throws Error with `HIRE_ORCHESTRATOR_ERROR_CODES` on invalid input, a
 * non-hired/absent applicant, a missing application/email/position, a Spring
 * create/verify failure, or a failed post-hire step.
 */
export async function runHireOrchestrator(
  rawInput: unknown
): Promise<HireOrchestrationResult> {
  const validation = HireOrchestrationInputSchema.safeParse(rawInput);
  if (!validation.success) {
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.invalidInput}: ${validation.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`
    );
  }
  const { applicantId, authToken } = validation.data;

  const applicant = await readHireApplicant(applicantId);
  if (!applicant) {
    await logHireActivity({
      userId: null,
      userName: `Applicant #${applicantId}`,
      userEmail: placeholderApplicantEmail(applicantId),
      ok: false,
      reason: `hire-orchestrator failed: ${HIRE_ORCHESTRATOR_ERROR_CODES.applicantNotFound}: applicant ${applicantId} does not exist; applicant=${applicantId}; application=none`,
    });
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.applicantNotFound}: applicant ${applicantId} does not exist`
    );
  }

  let applicationId: number | null = null;
  let email: string | null = null;
  let resolvedUserId: number | null = null;
  let userName = applicant.full_name?.trim() ?? `Applicant #${applicantId}`;

  try {
    if (applicant.status !== "hired") {
      throw new Error(
        `${HIRE_ORCHESTRATOR_ERROR_CODES.applicantNotHired}: applicant ${applicantId} is "${applicant.status}", not "hired"`
      );
    }

    const application = await readHireApplicationByApplicant(applicantId);
    if (!application) {
      throw new Error(
        `${HIRE_ORCHESTRATOR_ERROR_CODES.applicationNotFound}: applicant ${applicantId} has no linked application`
      );
    }
    applicationId = application.id;
    userName =
      [application.first_name, application.last_name]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part))
        .join(" ") ||
      userName ||
      `Applicant #${applicantId}`;

    email = resolveHireEmail(application);
    if (!email) {
      throw new Error(
        `${HIRE_ORCHESTRATOR_ERROR_CODES.emailMissing}: application ${application.id} carries no email to resolve the employee by`
      );
    }
    const position = resolveHirePosition(application, applicant);
    if (!position) {
      throw new Error(
        `${HIRE_ORCHESTRATOR_ERROR_CODES.positionMissing}: application ${application.id} carries no job position`
      );
    }

    const payload = buildSpringUserPayload(application, applicant, position);
    const resolved = await resolveHireUser({ email, payload, authToken });
    resolvedUserId = resolved.userId;

    const steps = await runHireSteps({
      applicantId,
      applicationId: application.id,
      userId: resolved.userId,
      userCreated: resolved.created,
      email,
    });

    await logHireActivity({
      userId: resolved.userId,
      userName,
      userEmail: email,
      ok: true,
      reason: `hire-orchestrator success: ${resolved.created ? "created" : "reused"} user_id=${resolved.userId} for applicant=${applicantId} application=${application.id}; steps=[${steps.map((step) => step.step).join(",") || "-"}]`,
    });

    return {
      applicantId,
      applicationId: application.id,
      userId: resolved.userId,
      userCreated: resolved.created,
      email,
      steps,
    };
  } catch (error) {
    await logHireActivity({
      userId: resolvedUserId,
      userName,
      userEmail: email ?? placeholderApplicantEmail(applicantId),
      ok: false,
      reason: `hire-orchestrator failed: ${toMessage(error)}; applicant=${applicantId}; application=${applicationId ?? "none"}`,
    });
    throw error;
  }
}
