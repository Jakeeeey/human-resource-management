"use client";

// PortalModule.tsx — hiree portal root (Todo 9). Two tabs, zero HR actions:
// Documents (own checklist + canon upload) and Signing (entry launching the
// Todo 7 surface pre-scoped to the hiree's own envelopes). Module header
// per QA §6. The HR hub is never rendered here — no hub route/action leaks
// into the portal, and vice versa.

import { useCallback, useEffect, useState } from "react";
import { PortalFetchProvider, usePortalFetch } from "./providers/portalProvider";
import { usePortalChecklist } from "./hooks/usePortalChecklist";
import { ChecklistTable } from "./components/ChecklistTable";
import { SigningEntryTab } from "./components/SigningEntryTab";
import { SigningEnvelopeFetchProvider } from "../onboarding/signing/providers/signingEnvelopeProvider";
import { SigningSurface } from "../onboarding/signing/components/SigningSurface";
import type { SigningEnvelope } from "../onboarding/signing/types/signing-envelope.schema";
import type { PaperworkTemplate } from "../onboarding/paperwork/types/paperwork-template.schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileCheck2 } from "lucide-react";

function SigningHost({
  envelope,
  profileId,
  onDone,
}: {
  envelope: SigningEnvelope;
  profileId: number;
  onDone: () => void;
}) {
  const [template, setTemplate] = useState<PaperworkTemplate | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/hrm/onboarding/paperwork-templates/${envelope.template_id}`,
          { cache: "no-store" }
        );
        const body = (await res.json().catch(() => null)) as {
          data?: PaperworkTemplate;
        } | null;
        if (!cancelled) {
          if (res.ok && body?.data) setTemplate(body.data);
          else setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [envelope.template_id]);

  if (failed) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Could not load this paperwork</AlertTitle>
        <AlertDescription>Refresh and try again.</AlertDescription>
      </Alert>
    );
  }

  if (!template) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading your paperwork…
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={onDone} className="w-full sm:w-auto">
        Back to my envelopes
      </Button>
      <SigningEnvelopeFetchProvider>
        <SigningSurface
          template={template}
          envelope={envelope}
          actor={{ role: "hiree", profile_id: profileId }}
        />
      </SigningEnvelopeFetchProvider>
    </div>
  );
}

function PortalBody() {
  const {
    session,
    checklist,
    envelopes,
    isLoading,
    isError,
    error,
    refetch,
    upload,
    uploadingKey,
  } = usePortalChecklist();
  const { refetch: refetchEnvelopes } = usePortalFetch();
  const [selected, setSelected] = useState<SigningEnvelope | null>(null);

  const handleSelect = useCallback((envelope: SigningEnvelope) => {
    setSelected(envelope);
  }, []);

  const handleDone = useCallback(() => {
    setSelected(null);
    void refetchEnvelopes();
  }, [refetchEnvelopes]);

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
            Your documents and paperwork — only your own hire record.
          </p>
        </div>
      </div>

      {selected && session ? (
        <SigningHost
          envelope={selected}
          profileId={session.profile_id}
          onDone={handleDone}
        />
      ) : (
        <Tabs defaultValue="documents" className="space-y-4">
          <div className="overflow-x-auto">
            <TabsList className="w-max min-w-full">
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="signing">Signing</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="documents">
            <ChecklistTable
              items={checklist}
              isLoading={isLoading}
              isError={isError}
              error={error}
              uploadingKey={uploadingKey}
              onRefresh={() => void refetch()}
              onUpload={(docKey, file) => void upload(docKey, file)}
            />
          </TabsContent>
          <TabsContent value="signing">
            <SigningEntryTab
              envelopes={envelopes}
              isLoading={isLoading}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
            />
          </TabsContent>
        </Tabs>
      )}
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
