import { listHireCompletionSteps } from "./hire-steps";
import { jobOfferFilingStep } from "./job-offer-filing-step";
import { logHireActivity, placeholderApplicantEmail } from "./hire-log";
import { runHireOrchestrator } from "./hire-orchestrator";
import { signingFilingStep } from "./signing-filing-step";

const SIGNING_PROVISION_ALLOWED_STATUSES = [
  "for_signing",
  "incomplete",
  "signing_complete",
] as const;

const SIGNING_FILING_ALLOWED_STEPS = new Set([
  signingFilingStep,
  jobOfferFilingStep,
]);

export function listSigningProvisionSkipSteps(): string[] {
  return listHireCompletionSteps()
    .filter((step) => !SIGNING_FILING_ALLOWED_STEPS.has(step))
    .map((step) => step.name || "post-hire-step");
}

export interface ProvisionHireUserAtSigningInput {
  applicantId: number;
  actorId?: number | null;
}

export async function provisionHireUserAtSigning(
  input: ProvisionHireUserAtSigningInput
): Promise<number | null> {
  try {
    const result = await runHireOrchestrator({
      applicantId: input.applicantId,
      ...(input.actorId != null ? { actorId: input.actorId } : {}),
      allowedStatuses: [...SIGNING_PROVISION_ALLOWED_STATUSES],
      skipSteps: listSigningProvisionSkipSteps(),
    });
    return result.userId;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    try {
      await logHireActivity({
        userId: null,
        userName: `Applicant #${input.applicantId}`,
        userEmail: placeholderApplicantEmail(input.applicantId),
        ok: false,
        reason: `signing-time provisioning failed for applicant=${input.applicantId}: ${reason} (signing-time provisioning attempt; heals on the next signing recompute or at the hire gate, which reuses the user by identity)`,
      });
    } catch (auditError) {
      console.error(
        `[signing] signing-time provisioning audit failed for applicant=${input.applicantId}:`,
        auditError instanceof Error ? auditError.message : String(auditError)
      );
    }
    return null;
  }
}
