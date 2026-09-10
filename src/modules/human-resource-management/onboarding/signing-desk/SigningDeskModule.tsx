"use client";

// SigningDeskModule.tsx — HR-operated signing desk (Todo 19). Post-offer
// kiosk queue: pick hire (onboarding profile) → pick paperwork (template +
// envelope) → sign on kiosk (Todo 7 surface, actor role "hr") → finish
// (Todo 6 validity gate) → filed (Todo 8 panel inside the surface).
// UI entry only — envelope/finish/file API routes are consumed unchanged.
// The hiree portal keeps checklist + upload and links here nowhere.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, PenLine } from "lucide-react";
import { SigningEnvelopeFetchProvider, useSigningEnvelopeFetch } from "../signing/providers/signingEnvelopeProvider";
import { SigningSurface } from "../signing/components/SigningSurface";
import {
  listPaperworkCompanies,
  resolveLegacyCompanyIds,
  type PaperworkCompany,
} from "../paperwork/providers/paperworkCompanyProvider";
import {
  listAllTemplateCompanies,
  toTemplateCompanyMap,
} from "../paperwork/providers/paperworkTemplateCompanies";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OnboardingProfile } from "../hub/types/onboarding-profile.schema";
import type { PaperworkTemplate } from "../paperwork/types/paperwork-template.schema";
import type { SigningEnvelope } from "../signing/types/signing-envelope.schema";

interface ListResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface SingleResponse<T> {
  success: boolean;
  data?: T | null;
  message?: string;
}

async function readJson(res: Response): Promise<ListResponse<never>> {
  return (await res.json().catch(() => null)) as ListResponse<never>;
}

interface SigningSession {
  template: PaperworkTemplate;
  envelope: SigningEnvelope;
}

function DeskBody() {
  const { openDraft } = useSigningEnvelopeFetch();
  const [profiles, setProfiles] = useState<OnboardingProfile[]>([]);
  const [templates, setTemplates] = useState<PaperworkTemplate[]>([]);
  const [envelopes, setEnvelopes] = useState<SigningEnvelope[]>([]);
  const [companies, setCompanies] = useState<PaperworkCompany[]>([]);
  const [templateCompanyIds, setTemplateCompanyIds] = useState<
    Map<number, number[]>
  >(new Map());
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [signing, setSigning] = useState<SigningSession | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(1));
  const [isLoadingEnvelopes, setIsLoadingEnvelopes] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const templateById = useMemo(() => {
    const map = new Map<number, PaperworkTemplate>();
    for (const template of templates) map.set(template.id, template);
    return map;
  }, [templates]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  );

  const companyIdsFor = useCallback(
    (template: PaperworkTemplate): number[] => {
      const ids = templateCompanyIds.get(template.id);
      if (ids && ids.length > 0) return ids;
      return resolveLegacyCompanyIds(companies, template.company_key);
    },
    [templateCompanyIds, companies]
  );

  const companyById = useMemo(() => {
    const map = new Map<number, PaperworkCompany>();
    for (const company of companies) map.set(company.id, company);
    return map;
  }, [companies]);

  // Kiosk model: HR picks the company at the queue; the paperwork list
  // scopes to templates carrying that company (junction match, legacy key
  // fallback when the junction is empty).
  const filteredTemplates = useMemo(() => {
    if (companyFilter === "all") return templates;
    const picked = Number(companyFilter);
    return templates.filter((template) =>
      companyIdsFor(template).includes(picked)
    );
  }, [templates, companyFilter, companyIdsFor]);

  const loadQueue = useCallback(async () => {
    try {
      setIsLoading(Boolean(1));
      setIsError(false);
      setError(null);
      const [profilesRes, templatesRes] = await Promise.all([
        fetch("/api/hrm/onboarding/profiles?limit=100", { cache: "no-store" }),
        fetch("/api/hrm/onboarding/paperwork-templates?limit=100", { cache: "no-store" }),
      ]);
      if (!profilesRes.ok) throw new Error("Hire queue fetch failed");
      if (!templatesRes.ok) throw new Error("Paperwork registry fetch failed");
      const profilesBody = (await readJson(profilesRes)) as ListResponse<OnboardingProfile[]>;
      const templatesBody = (await readJson(templatesRes)) as ListResponse<PaperworkTemplate[]>;
      setProfiles(Array.isArray(profilesBody.data) ? profilesBody.data : []);
      setTemplates(Array.isArray(templatesBody.data) ? templatesBody.data : []);
      const [directory, junction] = await Promise.all([
        listPaperworkCompanies(),
        listAllTemplateCompanies(),
      ]);
      setCompanies(directory);
      setTemplateCompanyIds(toTemplateCompanyMap(junction));
    } catch (err) {
      setIsError(Boolean(1));
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const loadEnvelopes = useCallback(async (profileId: number) => {
    try {
      setIsLoadingEnvelopes(Boolean(1));
      const res = await fetch(`/api/hrm/onboarding/signing-envelopes?profile_id=${profileId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Envelope queue fetch failed");
      const body = (await readJson(res)) as ListResponse<SigningEnvelope[]>;
      setEnvelopes(Array.isArray(body.data) ? body.data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envelope queue fetch failed");
      setEnvelopes([]);
    } finally {
      setIsLoadingEnvelopes(false);
    }
  }, []);

  const handleSelectProfile = useCallback(
    (profileId: number) => {
      setSelectedProfileId(profileId);
      setSigning(null);
      void loadEnvelopes(profileId);
    },
    [loadEnvelopes]
  );

  const launchSurface = useCallback(
    async (profileId: number, templateId: number, key: string) => {
      setLaunching(key);
      try {
        const templateRes = await fetch(`/api/hrm/onboarding/paperwork-templates/${templateId}`, {
          cache: "no-store",
        });
        if (!templateRes.ok) throw new Error("Paperwork template fetch failed");
        const templateBody = (await readJson(templateRes)) as SingleResponse<PaperworkTemplate>;
        if (!templateBody.success || !templateBody.data) {
          throw new Error(templateBody.message || "Paperwork template not found");
        }
        const picked = templateBody.data;
        if (picked.source !== "pdf" || !picked.pdf_file) {
          toast.error("PDF-only signing — link a PDF file to this template before opening the kiosk");
          return;
        }
        let envelope: SigningEnvelope | null = null;
        try {
          envelope = await openDraft(profileId, templateId);
        } catch (err) {
          // Idempotent open: a 409 means the draft already exists — resume it.
          const message = err instanceof Error ? err.message : String(err);
          if (!message.toLowerCase().includes("already exists")) throw err;
          const res = await fetch(
            `/api/hrm/onboarding/signing-envelopes?profile_id=${profileId}&template_id=${templateId}`,
            { cache: "no-store" }
          );
          if (!res.ok) throw new Error("Envelope resume fetch failed");
          const body = (await readJson(res)) as ListResponse<SigningEnvelope[]>;
          const rows = Array.isArray(body.data) ? body.data : [];
          envelope =
            rows.find((row) => row.status === "draft") ?? rows[0] ?? null;
          if (!envelope) throw new Error("Envelope already exists but could not be resumed");
          toast.success("Resumed the existing draft envelope");
        }
        if (envelope) setSigning({ template: picked, envelope });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not open the signing surface");
      } finally {
        setLaunching(null);
      }
    },
    [openDraft]
  );

  const handleBackToQueue = useCallback(() => {
    setSigning(null);
    if (selectedProfileId !== null) void loadEnvelopes(selectedProfileId);
  }, [loadEnvelopes, selectedProfileId]);

  if (signing && selectedProfileId !== null) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleBackToQueue}
          className="min-h-8 w-full sm:w-auto"
        >
          Back to signing queue
        </Button>
        <SigningEnvelopeFetchProvider>
          <SigningSurface
            template={signing.template}
            envelope={signing.envelope}
            actor={{ role: "hr", profile_id: selectedProfileId }}
            onEnvelopeChange={(envelope) =>
              setSigning((cur) => (cur ? { ...cur, envelope } : cur))
            }
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
          <h2 className="truncate text-base font-semibold sm:text-lg" title="Step 1 — pick the hire">
            Step 1 — pick the hire
          </h2>
          <p className="truncate text-xs text-muted-foreground sm:text-sm" title="Post-offer hires waiting for kiosk signing">
            Post-offer hires waiting for kiosk signing
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Hire</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Offer</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="space-y-2 py-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <p className="py-6 text-center text-muted-foreground">
                      No hires in the onboarding queue yet.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell
                      className="max-w-[220px] truncate font-medium"
                      title={`Profile #${profile.id} — employee ${profile.employee_id}`}
                    >
                      Profile #{profile.id} — employee {profile.employee_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="max-w-[200px] truncate" title={profile.status}>
                        {profile.status}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="max-w-[160px] truncate"
                      title={profile.offer_accepted ? "Accepted" : "Pending"}
                    >
                      {profile.offer_accepted ? "Accepted" : "Pending"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant={selectedProfileId === profile.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSelectProfile(profile.id)}
                        aria-label={`Pick hire profile ${profile.id}`}
                      >
                        {selectedProfileId === profile.id ? "Selected" : "Pick hire"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="bg-card overflow-hidden rounded-2xl border border-border/50 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold sm:text-lg" title="Step 2 — pick the paperwork">
              Step 2 — pick the paperwork
            </h2>
            <p className="truncate text-xs text-muted-foreground sm:text-sm" title="Choose a template to start or resume the kiosk signing">
              Choose a template to start or resume the kiosk signing
            </p>
          </div>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger
              className="h-9 w-full sm:w-[220px]"
              aria-label="Filter paperwork by company"
            >
              <SelectValue placeholder="All companies" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all">All companies</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={String(company.id)}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Paperwork</TableHead>
                <TableHead>Companies</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Envelope</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="space-y-2 py-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : !selectedProfile ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <p className="py-6 text-center text-muted-foreground">
                      Pick a hire first — their paperwork queue appears here.
                    </p>
                  </TableCell>
                </TableRow>
              ) : templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <p className="py-6 text-center text-muted-foreground">
                      No paperwork templates in the registry yet.
                    </p>
                  </TableCell>
                </TableRow>
              ) : filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <p className="py-6 text-center text-muted-foreground">
                      No paperwork scoped to this company yet.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates.map((template) => {
                  const existing = envelopes.find(
                    (envelope) => envelope.template_id === template.id
                  );
                  const key = `launch-${template.id}`;
                  const ids = companyIdsFor(template);
                  const names = ids.map(
                    (id) => companyById.get(id)?.name ?? `#${id}`
                  );
                  const companyTitle =
                    names.length > 0
                      ? names.join(", ")
                      : template.company_key;
                  return (
                    <TableRow key={template.id}>
                      <TableCell
                        className="max-w-[220px] truncate font-medium"
                        title={template.title}
                      >
                        {template.title}
                      </TableCell>
                      <TableCell
                        className="max-w-[180px] truncate text-xs text-muted-foreground"
                        title={companyTitle}
                      >
                        {companyTitle}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="max-w-[120px] truncate" title={template.source}>
                          {template.source}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="max-w-[180px] truncate"
                        title={existing ? `${existing.envelope_key} — ${existing.status}` : "No envelope yet"}
                      >
                        {existing ? existing.status : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={launching !== null}
                          onClick={() =>
                            void launchSurface(selectedProfile.id, template.id, key)
                          }
                          aria-label={`Sign ${template.title} on the kiosk`}
                          title={existing ? "Resume on the kiosk" : "Start on the kiosk"}
                        >
                          <PenLine className="mr-2 h-4 w-4" />
                          {launching === key
                            ? "Opening…"
                            : existing
                              ? "Resume signing"
                              : "Start signing"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {isLoadingEnvelopes && (
          <p className="px-3 py-2 text-xs text-muted-foreground sm:px-4">
            Loading this hire&apos;s envelopes…
          </p>
        )}
      </section>

      {selectedProfile && envelopes.length > 0 && (
        <section className="bg-card overflow-hidden rounded-2xl border border-border/50 shadow-sm">
          <div className="border-b border-border px-3 py-2 sm:px-4">
            <h2 className="truncate text-base font-semibold sm:text-lg" title="This hire's envelopes">
              This hire&apos;s envelopes
            </h2>
            <p className="truncate text-xs text-muted-foreground sm:text-sm" title="Drafts resume on the kiosk; finished envelopes open read-only for filing">
              Drafts resume on the kiosk; finished envelopes open read-only for filing
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Envelope</TableHead>
                  <TableHead>Paperwork</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Filed PDF</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {envelopes.map((envelope) => {
                  const template = templateById.get(envelope.template_id);
                  const key = `open-${envelope.id}`;
                  return (
                    <TableRow key={envelope.id}>
                      <TableCell
                        className="max-w-[220px] truncate font-medium"
                        title={envelope.envelope_key}
                      >
                        {envelope.envelope_key}
                      </TableCell>
                      <TableCell
                        className="max-w-[220px] truncate"
                        title={template?.title ?? `Template ${envelope.template_id}`}
                      >
                        {template?.title ?? `Template ${envelope.template_id}`}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="max-w-[140px] truncate"
                          title={envelope.status}
                        >
                          {envelope.status}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="max-w-[160px] truncate"
                        title={envelope.pdf_file ?? ""}
                      >
                        {envelope.pdf_file ? "Filed" : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={launching !== null}
                          onClick={() =>
                            void launchSurface(selectedProfile.id, envelope.template_id, key)
                          }
                          aria-label={`Open envelope ${envelope.envelope_key} on the kiosk`}
                          title={
                            envelope.status === "finished"
                              ? "Open read-only for filing"
                              : "Resume on the kiosk"
                          }
                        >
                          <PenLine className="mr-2 h-4 w-4" />
                          {launching === key
                            ? "Opening…"
                            : envelope.status === "finished"
                              ? "Open"
                              : "Resume"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
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
          <h1 className="truncate text-2xl font-bold sm:text-4xl">
            Signing Desk
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            HR runs kiosk signing right after the offer — the hiree inks.
          </p>
        </div>
      </div>

      <SigningEnvelopeFetchProvider>
        <DeskBody />
      </SigningEnvelopeFetchProvider>
    </div>
  );
}
