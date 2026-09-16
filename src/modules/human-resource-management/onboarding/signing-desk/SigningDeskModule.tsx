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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  PenLine,
  Search,
  X,
} from "lucide-react";
import {
  SigningEnvelopeFetchProvider,
  useSigningEnvelopeFetch,
} from "../signing/providers/signingEnvelopeProvider";
import { SigningSurface } from "../signing/components/SigningSurface";
import { isCompletionPending } from "../signing/signingCopy";
import type { PaperworkTemplate } from "../paperwork/types/paperwork-template.schema";
import type {
  JobOffer,
  PaperworkItem,
  Paperworks,
  SigningEnvelope,
  SigningEnvelopeStatus,
} from "../signing/types/contracts";
import {
  SigningDeskQueueCards,
  type SigningQueueRow,
} from "./components/SigningDeskQueueCards";
import { SigningDeskTable } from "./components/SigningDeskTable";
import { signingDeskJobFields } from "./components/signingDeskFields";

interface DeskFilters {
  query: string;
  envelopeStatus: "all" | SigningEnvelopeStatus;
  attentionOnly: boolean;
}

const EMPTY_DESK_FILTERS: DeskFilters = {
  query: "",
  envelopeStatus: "all",
  attentionOnly: false,
};

const PAGE_SIZE = 10;

const ENVELOPE_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "complete", label: "Complete" },
] as const;

const ATTENTION_OPTIONS = [
  { value: "all", label: "All sets" },
  { value: "attention", label: "Needs attention" },
] as const;

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

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  ariaLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={ariaLabel} title={ariaLabel} className="h-10">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DeskFilterBar({
  filters,
  onChange,
  onReset,
}: {
  filters: DeskFilters;
  onChange: (next: DeskFilters) => void;
  onReset: () => void;
}) {
  const hasActiveFilters =
    filters.query !== "" ||
    filters.envelopeStatus !== "all" ||
    filters.attentionOnly;

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <Search
          className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="h-10 pl-8"
          aria-label="Search signing queue"
          title="Search signing queue"
          placeholder="Search applicant, position, or department…"
          value={filters.query}
          onChange={(event) =>
            onChange({ ...filters, query: event.target.value })
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-2 lg:w-[380px] lg:shrink-0">
        <FilterSelect
          ariaLabel="Filter by signing status"
          value={filters.envelopeStatus}
          placeholder="All statuses"
          options={ENVELOPE_STATUS_OPTIONS}
          onChange={(value) =>
            onChange({
              ...filters,
              envelopeStatus: value as DeskFilters["envelopeStatus"],
            })
          }
        />
        <FilterSelect
          ariaLabel="Filter by attention"
          value={filters.attentionOnly ? "attention" : "all"}
          placeholder="All sets"
          options={ATTENTION_OPTIONS}
          onChange={(value) =>
            onChange({ ...filters, attentionOnly: value === "attention" })
          }
        />
      </div>
      <Button
        variant="ghost"
        className="h-10 w-full shrink-0 px-3 lg:w-auto"
        onClick={onReset}
        disabled={!hasActiveFilters}
      >
        Reset
        <X className="ml-2 h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

function DeskPager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        disabled={page <= 1}
        onClick={() => onChange(1)}
        aria-label="First page"
        title="First page"
      >
        <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
        title="Previous page"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <span className="px-2 text-xs text-muted-foreground" aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
        title="Next page"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        disabled={page >= totalPages}
        onClick={() => onChange(totalPages)}
        aria-label="Last page"
        title="Last page"
      >
        <ChevronsRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
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
  const [filters, setFilters] = useState<DeskFilters>(EMPTY_DESK_FILTERS);
  const [page, setPage] = useState(1);

  const templateById = useMemo(() => {
    const map = new Map<number, PaperworkTemplate>();
    for (const template of templates) map.set(template.id, template);
    return map;
  }, [templates]);

  const allRows = useMemo<DeskRow[]>(() => {
    const applicantById = new Map(applicants.map((row) => [row.id, row]));
    const offerByApplicant = new Map(offers.map((row) => [row.applicant_id, row]));
    const paperworksByApplicant = new Map(
      paperworksRows.map((row) => [row.applicant_id, row])
    );
    return envelopes.map((envelope) => ({
      applicant: applicantById.get(envelope.applicant_id) ?? {
        id: envelope.applicant_id,
        full_name: `Applicant #${envelope.applicant_id}`,
        position_applied_for: null,
        status: null,
      },
      envelope,
      offer: offerByApplicant.get(envelope.applicant_id) ?? null,
      paperworks: paperworksByApplicant.get(envelope.applicant_id) ?? null,
    }));
  }, [applicants, envelopes, offers, paperworksRows]);

  const filteredRows = useMemo<DeskRow[]>(() => {
    const needle = filters.query.trim().toLowerCase();
    return allRows
      .filter((row) => {
        if (
          filters.envelopeStatus !== "all" &&
          row.envelope.status !== filters.envelopeStatus
        ) {
          return false;
        }
        if (
          filters.attentionOnly &&
          !isCompletionPending(row.envelope.status, row.applicant.status)
        ) {
          return false;
        }
        if (needle !== "") {
          const fields = signingDeskJobFields(
            row.applicant.position_applied_for,
            row.offer
          );
          const haystack = [
            row.applicant.full_name,
            fields.position ?? "",
            fields.department ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const createdA = a.envelope.created_at ?? "";
        const createdB = b.envelope.created_at ?? "";
        if (createdA !== createdB) return createdB.localeCompare(createdA);
        return b.envelope.id - a.envelope.id;
      });
  }, [allRows, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );
  const rangeStart =
    filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredRows.length);
  const hasActiveFilters =
    filters.query !== "" ||
    filters.envelopeStatus !== "all" ||
    filters.attentionOnly;
  const emptyCopy = hasActiveFilters
    ? "No signing sets match these filters."
    : undefined;

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

      <DeskFilterBar
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        onReset={() => {
          setFilters(EMPTY_DESK_FILTERS);
          setPage(1);
        }}
      />

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
          rows={visibleRows}
          isLoading={isLoading}
          launchingId={launching}
          emptyCopy={emptyCopy}
          onOpen={(row) => void openSigningSet(row)}
        />
        <SigningDeskTable
          rows={visibleRows}
          isLoading={isLoading}
          launchingId={launching}
          emptyCopy={emptyCopy}
          onOpen={(row) => void openSigningSet(row)}
        />
        <div className="flex flex-col gap-2 border-t border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {totalPages > 1
              ? `Showing ${rangeStart}–${rangeEnd} of ${filteredRows.length} sets · newest first`
              : `${filteredRows.length} set${filteredRows.length === 1 ? "" : "s"} · newest first`}
          </p>
          <DeskPager
            page={safePage}
            totalPages={totalPages}
            onChange={setPage}
          />
        </div>
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
