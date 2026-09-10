"use client";

// PortalModule.tsx — hiree portal root (todo 25 identity re-key). Checklist
// + upload + the post-hire Training taking view (todo 31). The session
// resolves the caller's own applicant (pre-hire) or employee (post-hire)
// identity server-side, so training only appears after the hire. Signing runs
// on the HR-operated, applicant-scoped signing desk (`hrm/onboarding/signing`)
// — no signing entry, surface, or envelope wiring lives here. Module header
// per QA §6. The HR hub is never rendered here — no hub route/action leaks
// into the portal, and vice versa.

import { PortalFetchProvider } from "./providers/portalProvider";
import { usePortalChecklist } from "./hooks/usePortalChecklist";
import { ChecklistTable } from "./components/ChecklistTable";
import { TrainingSection } from "./components/TrainingSection";
import { FileCheck2 } from "lucide-react";

function PortalBody() {
  const {
    checklist,
    isLoading,
    isError,
    error,
    refetch,
    upload,
    uploadingKey,
  } = usePortalChecklist();

  return (
    <div className="p-2 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-2xl shrink-0">
          <FileCheck2 className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-4xl font-bold truncate">
            My Onboarding
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Your documents and training — only your own hire record.
          </p>
        </div>
      </div>

      <ChecklistTable
        items={checklist}
        isLoading={isLoading}
        isError={isError}
        error={error}
        uploadingKey={uploadingKey}
        onRefresh={() => void refetch()}
        onUpload={(docKey, file) => void upload(docKey, file)}
      />

      <TrainingSection />
    </div>
  );
}

export function PortalModule() {
  return (
    <PortalFetchProvider>
      <PortalBody />
    </PortalFetchProvider>
  );
}
