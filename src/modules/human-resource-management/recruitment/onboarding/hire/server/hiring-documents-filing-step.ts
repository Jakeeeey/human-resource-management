import type {
  HireCompletionStep,
  HireCompletionStepResult,
} from "../types/hire.schema";
import { fileHiringDocumentsForHire } from "./hiring-documents-filing-service";

// hiring-documents-filing-step.ts — post-hire step.
//
// Runs AFTER the orchestrator resolved/created the employee: files the hiring
// documents (application photo/signature/attachments plus every filed portal
// slot file) into the employee's 201 file under Pre-Employment & Personal
// Records. Idempotent per the seam contract: file UUIDs already recorded for
// the employee are skipped, so a retried orchestration files zero duplicates.
// `userId` IS the correlation to the employee (no DB column is added).

const STEP_NAME = "hiring-documents-filing";

export const hiringDocumentsFilingStep: HireCompletionStep = async (
  context
): Promise<HireCompletionStepResult> => {
  try {
    const result = await fileHiringDocumentsForHire({
      applicantId: context.applicantId,
      userId: context.userId,
    });
    return {
      step: STEP_NAME,
      ok: true,
      detail: `user_id=${context.userId} applicant=${context.applicantId} filed=${result.filed} existing=${result.existing} list=${result.listId ?? "-"}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { step: STEP_NAME, ok: false, detail: message };
  }
};
