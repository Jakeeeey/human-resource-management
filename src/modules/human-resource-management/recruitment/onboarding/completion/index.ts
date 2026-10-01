// completion/index.ts — barrel for the employee task-set completion module.
export { CompletionTab } from "./components/CompletionTab";
export {
  ONBOARDING_EVENT_KEYS,
  buildCompletionDedupKey,
  buildEmployeeCompletionDispatchCtx,
  buildOnboardingDispatchCtx,
  isCompletionReady,
  isTaskSatisfied,
  missingChecklistItems,
  runCompletionChecklist,
} from "./completionChecklist";
export type {
  ChecklistItem,
  CompletionInputs,
  CompletionProfileLike,
  OnboardingEventKey,
} from "./completionChecklist";
