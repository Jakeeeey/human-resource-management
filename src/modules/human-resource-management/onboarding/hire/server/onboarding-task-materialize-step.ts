import type {
  HireCompletionStep,
  HireCompletionStepResult,
} from "../types/hire.schema";
import { materializeOnboardingTasks } from "../../tasks/server/onboarding-task-service";

// onboarding-task-materialize-step.ts — todo 19 post-hire step.
//
// Runs AFTER the orchestrator resolved/created the employee: materializes the
// `onboarding_task` rows for `context.userId` from the seeded template
// catalog. `userId` IS the correlation between the applicant workflow and the
// employee workflow (no DB column exists). Idempotent per the seam contract:
// a retried orchestration only creates the missing (user_id, template_id)
// pairs, so a resume never duplicates tasks.

const STEP_NAME = "onboarding-task-materialize";

export const onboardingTaskMaterializeStep: HireCompletionStep = async (
  context
): Promise<HireCompletionStepResult> => {
  try {
    const result = await materializeOnboardingTasks({
      userId: context.userId,
    });
    return {
      step: STEP_NAME,
      ok: true,
      detail: `user_id=${context.userId} templates=${result.templateCount} created=${result.created} existing=${result.existing} total=${result.total}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { step: STEP_NAME, ok: false, detail: message };
  }
};
