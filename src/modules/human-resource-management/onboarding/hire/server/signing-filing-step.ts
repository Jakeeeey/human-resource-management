import type {
  HireCompletionStep,
  HireCompletionStepResult,
} from "../types/hire.schema";
import { fileSignedPaperwork } from "../../signing/server/signing-filing-service";

// signing-filing-step.ts — todo 17 post-hire step.
//
// Runs AFTER the orchestrator resolved/created the employee: files every
// staged signed PDF (`paperwork_item.pdf_file`, uploaded pre-hire through the
// existing `?type=employee_file` path) into `employee_file_records` keyed to
// `context.userId` + the signed-documents intake list. The service refuses a
// non-hired applicant, so the pre-hire state is untouched by construction;
// `userId` IS the correlation to the employee (no DB FK / column is added).
// Idempotent per the seam contract: a retried orchestration files ZERO
// duplicates.

const STEP_NAME = "signing-filing";

export const signingFilingStep: HireCompletionStep = async (
  context
): Promise<HireCompletionStepResult> => {
  try {
    const result = await fileSignedPaperwork({
      applicantId: context.applicantId,
      userId: context.userId,
    });
    return {
      step: STEP_NAME,
      ok: true,
      detail: `user_id=${context.userId} applicant=${context.applicantId} list_id=${result.listId ?? "-"} signed=${result.signedItems} filed=${result.filed} existing=${result.existing} total=${result.total}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { step: STEP_NAME, ok: false, detail: message };
  }
};
