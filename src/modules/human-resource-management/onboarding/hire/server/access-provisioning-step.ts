import { completeTaskByCode } from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-service";

import type {
  HireCompletionStep,
  HireCompletionStepResult,
} from "../types/hire.schema";

// access-provisioning-step.ts — post-hire step.
//
// Runs AFTER the orchestrator resolved/created the employee: the Spring
// account creation IS the system-access provisioning event
// (`access_provisioned`: "System access provisioned (email + system
// access)"), so the matching task is closed here. There is no UI that
// completes it (owner_role `system`), and leaving it open freezes the
// equipment phase at 0/3 forever. Idempotent per the seam contract: an
// already-done or absent task reports success without writing. `userId` IS
// the correlation to the employee (no DB column is added).

const STEP_NAME = "access-provisioning";

export const accessProvisioningStep: HireCompletionStep = async (
  context
): Promise<HireCompletionStepResult> => {
  try {
    const result = await completeTaskByCode({
      userId: context.userId,
      phase: "equipment",
      code: "access_provisioned",
      completedBy: null,
    });
    return {
      step: STEP_NAME,
      ok: true,
      detail: `user_id=${context.userId} completed=${result.completed} task=${result.taskId ?? "-"}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { step: STEP_NAME, ok: false, detail: message };
  }
};
