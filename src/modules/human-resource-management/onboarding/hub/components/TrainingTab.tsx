"use client";

import { TrainingOverviewTab } from "@/modules/human-resource-management/onboarding/training/components/TrainingOverviewTab";
import { TrainingAssignmentFetchProvider } from "@/modules/human-resource-management/onboarding/training/providers/trainingAssignmentProvider";

// TrainingTab.tsx — the workspace Training section (todos 31/32). The employee
// is the canonical selected hire from the route, so there is no hire picker;
// this component only wires the existing training engine to that principal.

export function TrainingTab({ userId }: { userId: number }) {
  return (
    <TrainingAssignmentFetchProvider userId={userId}>
      <TrainingOverviewTab userId={userId} />
    </TrainingAssignmentFetchProvider>
  );
}
