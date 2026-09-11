"use client";

// SigningDeskModule.tsx — HR-operated signing desk (todo 13 re-key). The desk
// queues APPLICANTS that already own a signing set (todo 10 materialized the
// envelope + offer + paperwork batch on Final Approved). Selecting an
// applicant opens the applicant-scoped SigningSurface, which signs the offer
// and the full `paperwork_item` set. There is no onboarding-profile queue
// and no per-template envelope selection.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, PenLine } from "lucide-react";
import {
  SigningEnvelopeFetchProvider,
  useSigningEnvelopeFetch,
} from "../signing/providers/signingEnvelopeProvider";
import { SigningSurface } from "../signing/components/SigningSurface";
import type { PaperworkTemplate } from "../paperwork/types/paperwork-template.schema";
import type {
  JobOffer,
  PaperworkItem,
  Paperworks,
  SigningEnvelope,
} from "../signing/types/contracts";
import {
  SigningDeskQueueCards,
  type SigningQueueRow,
} from "./components/SigningDeskQueueCards";
import { SigningDeskTable } from "./components/SigningDeskTable";

interface ApplicantSummary {
  id: number;
  full_name: string;
  position_applied_for: string | null;
  status: string | null;
}

interface ApplicantListResponse {
  data?: ApplicantSummary[];
}

interface TemplateListResponse {
  success?: boolean;
  data?: PaperworkTemplate[];
}

type DeskRow = SigningQueueRow;

interface OpenSigningSet {
  row: DeskRow;
  items: PaperworkItem[];
}

function DeskBody() {
  const { listEnvelopes, listJobOffers, listPaperworks, listPaperworkItems } =
    useSigningEnvelopeFetch();
  const [applicants, setApplicants] = useState<ApplicantSummary[]>([]);
  const [templates, setTemplates] = useState<PaperworkTemplate[]>([]);
  const [envelopes, setEnvelopes] = useState<SigningEnvelope[]>([]);
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [paperworksRows, setPaperworksRows] = useState<Paperworks[]>([]);
  const [signing, setSigning] = useState<OpenSigningSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [launching, setLaunching] = useState<number | null>(null);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const templateById = useMemo(() => {
    const map = new Map<number, PaperworkTemplate>();
    for (const template of templates) map.set(template.id, template);
    return map;
  }, [templates]);

  const rows = useMemo<DeskRow[]>(() => {
    const applicantById = new Map(applicants.map((row) => [row.id, row]));
    const offerByApplicant = new Map(offers.map((row) => [row.applicant_id, row]));
    const paperworksByApplicant = new Map(
      paperworksRows.map((row) => [row.applicant_id, row])
    );
    return envelopes
      .map((envelope) => ({
        applicant: applicantById.get(envelope.applicant_id) ?? {
          id: envelope.applicant_id,
          full_name: `Applicant #${envelope.applicant_id}`,
          position_applied_for: null,
          status: null,
        },
        envelope,
        offer: offerByApplicant.get(envelope.applicant_id) ?? null,
        paperworks: paperworksByApplicant.get(envelope.applicant_id) ?? null,
      }))
      .sort((a, b) => a.applicant.full_name.localeCompare(b.applicant.full_name));
  }, [applicants, envelopes, offers, paperworksRows]);

  const loadQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      const [applicantsRes, templatesRes] = await Promise.all([
        fetch("/api/hrm/applicants", { cache: "no-store" }),
        fetch("/api/hrm/onboarding/paperwork-templates?limit=100", {
          cache: "no-store",
        }),
      ]);
      if (!applicantsRes.ok) throw new Error("Applicant queue fetch failed");
      if (!templatesRes.ok) throw new Error("Paperwork registry fetch failed");
      const applicantsBody = (await applicantsRes
        .json()
        .catch(() => null)) as ApplicantListResponse | null;
      const templatesBody = (await templatesRes
        .json()
        .catch(() => null)) as TemplateListResponse | null;
      const [envelopeRows, offerRows, paperworks] = await Promise.all([
        listEnvelopes(),
        listJobOffers(),
        listPaperworks(),
      ]);
      setApplicants(Array.isArray(applicantsBody?.data) ? applicantsBody.data : []);
      setTemplates(Array.isArray(templatesBody?.data) ? templatesBody.data : []);
      setEnvelopes(envelopeRows);
      setOffers(offerRows);
      setPaperworksRows(paperworks);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [listEnvelopes, listJobOffers, listPaperworks]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const openSigningSet = useCallback(
    async (row: DeskRow) => {
      setLaunching(row.envelope.id);
      try {
        const items = row.paperworks
          ? await listPaperworkItems(row.paperworks.id)
          : [];
        setSigning({ row, items });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not open the signing set"
        );
      } finally {
        setLaunching(null);
      }
    },
    [listPaperworkItems]
  );

  if (signing) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSigning(null);
            void loadQueue();
          }}
          className="min-h-8 w-full sm:w-auto"
        >
          Back to signing queue
        </Button>
        <SigningEnvelopeFetchProvider>
          <SigningSurface
            key={signing.row.envelope.id}
            applicantId={signing.row.applicant.id}
            applicantName={signing.row.applicant.full_name}
            applicantStatus={signing.row.applicant.status}
            envelope={signing.row.envelope}
            offer={signing.row.offer}
            paperworks={signing.row.paperworks}
            items={signing.items}
            templatesById={templateById}
            onChanged={() => void loadQueue()}
          />
        </SigningEnvelopeFetchProvider>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load the signing queue</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{error?.message ?? "Refresh and try again."}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadQueue()}
              className="min-h-8 w-full sm:w-auto"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="bg-card overflow-hidden rounded-2xl border border-border/50 shadow-sm">
        <div className="border-b border-border px-3 py-2 sm:px-4">
          <h2
            className="truncate text-base font-semibold sm:text-lg"
            title="Applicants with a signing set"
          >
            Applicants with a signing set
          </h2>
          <p
            className="truncate text-xs text-muted-foreground sm:text-sm"
            title="Offer + paperwork created on Final Approved — open a set to sign or review"
          >
            Offer + paperwork created on Final Approved — open a set to sign or
            review
          </p>
        </div>
        <SigningDeskQueueCards
          rows={rows}
          isLoading={isLoading}
          launchingId={launching}
          onOpen={(row) => void openSigningSet(row)}
        />
        <SigningDeskTable
          rows={rows}
          isLoading={isLoading}
          launchingId={launching}
          onOpen={(row) => void openSigningSet(row)}
        />
      </section>
    </div>
  );
}

export function SigningDeskModule() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1600px] space-y-8 p-2 sm:p-6 md:p-10">
      <div className="flex items-center gap-4">
        <div className="shrink-0 rounded-2xl bg-primary/10 p-3">
          <PenLine className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold sm:text-4xl">Signing Desk</h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            HR runs kiosk signing right after the offer — the hiree inks the
            offer and every required document.
          </p>
        </div>
      </div>

      <SigningEnvelopeFetchProvider>
        <DeskBody />
      </SigningEnvelopeFetchProvider>
    </div>
  );
}
