import type { HireCompletionStep } from "../types/hire.schema";
import { onboardingTaskMaterializeStep } from "./onboarding-task-materialize-step";
import { signingFilingStep } from "./signing-filing-step";

// hire-steps.ts — the post-hire SEAM (todo 16).
//
// The orchestrator is the SINGLE completion entry point. Todos 17 (signed
// PDF filing) and 19 (onboarding_task materialization) do NOT edit the
// orchestrator flow — they each:
//
//   1. add `onboarding/hire/server/<feature>-step.ts` exporting one
//      `HireCompletionStep` (idempotent; uses `context.userId` as the ONLY
//      correlation to the employee — no DB column is added);
//   2. import it above and register it in the POST-HIRE STEP REGISTRATION
//      block at the bottom.
//
// Registration happens HERE, not as a top-level call inside the step module:
// a step that imported this module to self-register would close an ESM cycle
// and read `registeredSteps` before its initialization (TDZ). The step module
// stays a pure export; the seam owns registration order.
//
// Steps run in registration order AFTER the user is resolved/created, once
// per orchestration run (retries re-run them; they must be idempotent).

const registeredSteps: HireCompletionStep[] = [];

/**
 * Registers one post-hire step. Registration is idempotent per function
 * reference (module re-evaluation cannot double-run a step).
 * @param step - Idempotent hire completion step.
 */
export function registerHireCompletionStep(step: HireCompletionStep): void {
  if (registeredSteps.includes(step)) return;
  registeredSteps.push(step);
}

/**
 * @returns The registered steps in registration order (callers must not mutate).
 */
export function listHireCompletionSteps(): readonly HireCompletionStep[] {
  return registeredSteps;
}

// ---- POST-HIRE STEP REGISTRATION (todos 17/19 append here) ----
registerHireCompletionStep(onboardingTaskMaterializeStep); // todo 19
registerHireCompletionStep(signingFilingStep); // todo 17
