"use client";

// PortalModule.tsx — hiree portal root (todo 25 identity re-key). Documents /
// Training tabs: the uploadable document checklist and the read-only hub
// training checklist. The session
// resolves the caller's own applicant (pre-hire) or employee (post-hire)
// identity server-side, so training only appears after the hire. Signing runs
// on the HR-operated, applicant-scoped signing desk (`hrm/onboarding/signing`)
// — no signing entry, surface, or envelope wiring lives here. Module header
// per QA §6. The HR hub is never rendered here — no hub route/action leaks
// into the portal, and vice versa.

import { PortalFetchProvider } from "./providers/portalProvider";
import { usePortalChecklist } from "./hooks/usePortalChecklist";
import { ChecklistTable } from "./components/ChecklistTable";
import { TrainingChecklist } from "./components/TrainingChecklist";
import { FileCheck2 } from "lucide-react";
import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function PortalBody() {
  const {
    session,
    checklist,
    training,
    isLoading,
    isError,
    error,
    refetch,
    upload,
    uploadingKey,
  } = usePortalChecklist();
  const [tab, setTab] = useState("documents");

  const isPostHire = session !== null && session.user_id !== null;

  const checklistTable = (
    <ChecklistTable
      items={checklist}
      isLoading={isLoading}
      isError={isError}
      error={error}
      uploadingKey={uploadingKey}
      onRefresh={() => void refetch()}
      onUpload={(docKey, file) => void upload(docKey, file)}
    />
  );

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

      {isPostHire ? (
        <Tabs value={tab} onValueChange={setTab} className="grid gap-6">
          <TabsList className="justify-start">
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
          </TabsList>

          <TabsContent value="documents">{checklistTable}</TabsContent>

          <TabsContent value="training">
            <TrainingChecklist
              items={training}
              isLoading={isLoading}
              isError={isError}
              error={error}
            />
          </TabsContent>
        </Tabs>
      ) : (
        checklistTable
      )}
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
