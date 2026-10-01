"use client";

// TrainingTemplatesModule.tsx — onboarding training-templates admin root: the
// per-department (or global) training TEMPLATES and their child ITEMS, in a
// master-detail layout. Standalone module shell (mirrors
// RequirementsRegistryModule), mounted at `hrm/onboarding/training-templates` —
// never inside the per-hire OnboardingWorkspace. There is no admin/role gate:
// access is governed externally by the platform module authorization.

import { GraduationCap } from "lucide-react";

import { TrainingTemplatesProvider } from "./providers/trainingTemplatesProvider";
import { TrainingTemplatesWorkspace } from "./components/TrainingTemplatesWorkspace";

export function TrainingTemplatesModule() {
  return (
    <div className="p-2 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-2xl shrink-0">
          <GraduationCap className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-4xl font-bold truncate">
            Training Templates
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Per-department training topics new hires must complete.
          </p>
        </div>
      </div>

      <TrainingTemplatesProvider>
        <TrainingTemplatesWorkspace />
      </TrainingTemplatesProvider>
    </div>
  );
}
