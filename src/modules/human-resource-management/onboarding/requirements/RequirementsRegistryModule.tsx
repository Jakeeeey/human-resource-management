"use client";

// RequirementsRegistryModule.tsx — onboarding requirements admin root: the
// HR-owned catalogs for documents, orientation, training, and equipment.
// Standalone module shell (mirrors PaperworkRegistryModule), mounted at
// `hrm/onboarding/requirements` — never inside the per-hire OnboardingWorkspace.
//
// Todo 14 built this shell; todo 16 adds the four catalog sections, mounted
// under the todo-15 fetch provider. There is no admin/role gate: access is
// governed externally by the platform module authorization.

import { ListChecks } from "lucide-react";

import { RequirementsCatalogFetchProvider } from "./providers/requirementsCatalogProvider";
import { RequirementsSections } from "./components/RequirementsSections";

export function RequirementsRegistryModule() {
  return (
    <div className="p-2 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-2xl shrink-0">
          <ListChecks className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-4xl font-bold truncate">
            Onboarding Requirements
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Which documents, orientation topics, training, and equipment apply
            to new hires.
          </p>
        </div>
      </div>

      <RequirementsCatalogFetchProvider>
        <RequirementsSections />
      </RequirementsCatalogFetchProvider>
    </div>
  );
}
