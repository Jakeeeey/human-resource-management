// completion/index.ts — barrel for the Todo 14 completion orchestrator.
export { CompletionTab } from "./components/CompletionTab";
export {
  ACCESS_ITEM_KEYS,
  COMPLETION_CHECKLIST_ORDER,
  ONBOARDING_EVENT_KEYS,
  buildCompletionDedupKey,
  buildOnboardingDispatchCtx,
  isCompletionReady,
  missingChecklistItems,
  runCompletionChecklist,
} from "./completionChecklist";
export type {
  ChecklistItem,
  CompletionInputs,
  CompletionItemKey,
  CompletionProfileLike,
  OnboardingEventKey,
} from "./completionChecklist";
