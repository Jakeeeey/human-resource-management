"use client";

// PortalModule.tsx — hiree portal root (todo 25 identity re-key). Documents /
// Training / Equipment tabs: the uploadable document checklist, the read-only
// hub training checklist, and the post-hire equipment acknowledgement log. The
// session resolves the caller's own applicant (pre-hire) or employee
// (post-hire) identity server-side, so training and equipment only appear
// after the hire. Signing runs
// on the HR-operated, applicant-scoped signing desk (`hrm/onboarding/signing`)
// — no signing entry, surface, or envelope wiring lives here. Module header
// per QA §6. The HR hub is never rendered here — no hub route/action leaks
// into the portal, and vice versa.

import { PortalFetchProvider } from "./providers/portalProvider";
import { usePortalChecklist } from "./hooks/usePortalChecklist";
import { ChecklistTable } from "./components/ChecklistTable";
import { TrainingChecklist } from "./components/TrainingChecklist";
import { EquipmentChecklist } from "./components/EquipmentChecklist";
import { FileCheck2 } from "lucide-react";
import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAB_TRIGGER_CLASS =
  "text-base data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:border-transparent dark:data-[state=active]:text-primary-foreground";

function PortalBody() {
  const {
    session,
    checklist,
    training,
    equipment,
    isLoading,
    isError,
    error,
    refetch,
    upload,
    uploadingKey,
    acknowledge,
    acknowledgingKey,
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
          <TabsList className="justify-start group-data-[orientation=horizontal]/tabs:h-auto">
            <TabsTrigger value="documents" className={TAB_TRIGGER_CLASS}>
              Documents
            </TabsTrigger>
            <TabsTrigger value="training" className={TAB_TRIGGER_CLASS}>
              Training
            </TabsTrigger>
            <TabsTrigger value="equipment" className={TAB_TRIGGER_CLASS}>
              Equipment
            </TabsTrigger>
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

          <TabsContent value="equipment">
            <EquipmentChecklist
              items={equipment}
              isLoading={isLoading}
              isError={isError}
              error={error}
              acknowledgingKey={acknowledgingKey}
              onAcknowledge={(key) => void acknowledge(key)}
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
