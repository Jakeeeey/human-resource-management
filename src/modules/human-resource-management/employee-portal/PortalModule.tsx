"use client";

// PortalModule.tsx — hiree portal root (Todo 9, Todo 19 extraction).
// Checklist + upload ONLY: the hiree sees their own document checklist and
// files uploads through the application-form canon. Signing runs on the
// HR-operated signing desk (`hrm/onboarding/signing`) — no signing entry,
// surface, or envelope wiring lives here. Module header per QA §6. The HR
// hub is never rendered here — no hub route/action leaks into the portal,
// and vice versa.

import { PortalFetchProvider } from "./providers/portalProvider";
import { usePortalChecklist } from "./hooks/usePortalChecklist";
import { ChecklistTable } from "./components/ChecklistTable";
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
            Your documents — only your own hire record.
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
    </div>
  );
}

export function PortalModule({
  initialProfileId,
}: {
  initialProfileId: number | null;
}) {
  return (
    <PortalFetchProvider initialProfileId={initialProfileId}>
      <PortalBody />
    </PortalFetchProvider>
  );
}
