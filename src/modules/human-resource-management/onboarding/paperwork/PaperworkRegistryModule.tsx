"use client";

// PaperworkRegistryModule.tsx — paperwork registry root: PDF templates per
// company + click-drag zone marking + the single validity predicate (exported
// from `./paperworkValidity` for the signing surface). Standalone module shell
// per QA §6, mounted at `hrm/onboarding/paperwork` — never inside the hub.

import { PaperworkTemplateFetchProvider } from "./providers/paperworkTemplateProvider";
import { TemplatesTab } from "./components/TemplatesTab";
import { FileText } from "lucide-react";

export function PaperworkRegistryModule() {
  return (
    <div className="p-2 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-2xl shrink-0">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-4xl font-bold truncate">
            Paperwork Templates
          </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              PDF paperwork per company with admin-marked signature zones.
            </p>
        </div>
      </div>

      <PaperworkTemplateFetchProvider>
        <TemplatesTab />
      </PaperworkTemplateFetchProvider>
    </div>
  );
}
