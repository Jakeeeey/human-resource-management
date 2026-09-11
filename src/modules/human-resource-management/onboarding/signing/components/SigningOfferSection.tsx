"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaperworkTemplate } from "../../paperwork/types/paperwork-template.schema";
import { isPaperworkValid } from "../../paperwork/paperworkValidity";
import type { InkCanvasHandle } from "../InkCanvas";
import type { SignOfferResult } from "../providers/signingEnvelopeProvider";
import {
  parseInk,
  type SigningInk,
  type SigningStroke,
} from "../signingStrokes";
import type { JobOffer } from "../types/contracts";
import {
  SIGNING_PAGE_H,
  SIGNING_PAGE_W,
  TemplatePageView,
} from "./TemplatePageView";
import { useSigningOfferPdf } from "./useSigningOfferPdf";
import { useSigningOfferSign } from "./useSigningOfferSign";

// SigningOfferSection.tsx — the Job offer card IS the offer's signing view:
// the HR-uploaded offer PDF renders through the shared TemplatePageView
// (zones empty — the whole page is signable) and the hiree's ink signature IS
// the acceptance. A valid signature (>=1 ink mark) enables "Sign & file
// offer", which files the signed PDF and PATCHes the offer to signed; the
// parent receives the post-recompute rows to lift into surface state.

interface SigningOfferSectionProps {
  offer: JobOffer | null;
  onAccepted: (result: SignOfferResult) => void;
  onOfferChanged?: () => void;
}

function offerLabel(offer: JobOffer | null): string {
  if (!offer) return "No offer on file";
  if (offer.status === "signed") {
    return offer.signed_at ? `Signed — ${offer.signed_at}` : "Signed";
  }
  return offer.status;
}

function parseInkSafe(raw: string | null | undefined): SigningInk | null {
  if (!raw || raw.trim() === "") return null;
  try {
    return parseInk(raw);
  } catch {
    return null;
  }
}

function seedInkPages(
  raw: string | null | undefined
): Record<number, SigningStroke[]> {
  const seed: Record<number, SigningStroke[]> = {};
  const content = parseInkSafe(raw);
  for (const page of content?.pages ?? []) {
    seed[page.page] = Array.isArray(page.strokes) ? page.strokes : [];
  }
  return seed;
}

export function SigningOfferSection({
  offer,
  onAccepted,
  onOfferChanged,
}: SigningOfferSectionProps) {
  const pdf = useSigningOfferPdf(offer?.pdf_file ?? null);
  const [inkPages, setInkPages] = useState<Record<number, SigningStroke[]>>(
    () => seedInkPages(offer?.strokes)
  );
  const canvasHandles = useRef<Record<number, InkCanvasHandle | null>>({});
  const offerFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingOffer, setUploadingOffer] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageDraft, setPageDraft] = useState("1");

  const offerSigned = offer?.status === "signed";
  const offerPdfMissing = offer === null || offer.pdf_file === null;
  const canUploadOfferPdf =
    offer !== null && (offer.pdf_file === null || !offerSigned);

  useEffect(() => {
    setInkPages(seedInkPages(offer?.strokes));
  }, [offer?.id, offer?.strokes]);

  const numPages = Math.max(1, pdf.pages.length);

  useEffect(() => {
    setActivePage((current) => Math.min(numPages, Math.max(1, current)));
  }, [numPages]);

  useEffect(() => {
    setPageDraft(String(activePage));
  }, [activePage]);

  const offerTemplate = useMemo<PaperworkTemplate | null>(() => {
    if (!offer?.pdf_file) return null;
    return {
      id: offer.id,
      title: "Job Offer",
      zones: [],
      is_active: true,
      source: "pdf",
      pdf_file: offer.pdf_file,
      created_at: null,
      created_by: null,
      updated_at: null,
      updated_by: null,
    };
  }, [offer]);

  const ink: SigningInk = useMemo(
    () => ({
      pages: pdf.pages.map((page) => ({
        page,
        strokes: inkPages[page] ?? [],
      })),
    }),
    [pdf.pages, inkPages]
  );
  const verdict = useMemo(
    () => isPaperworkValid([], ink, pdf.pageSizes),
    [ink, pdf.pageSizes]
  );

  const registerCanvas = useCallback(
    (page: number, handle: InkCanvasHandle | null) => {
      canvasHandles.current[page] = handle;
    },
    []
  );

  const handleStrokesChange = useCallback(
    (page: number, strokes: SigningStroke[]) => {
      setInkPages((prev) => ({ ...prev, [page]: strokes }));
    },
    []
  );

  const handleClearPage = useCallback((page: number) => {
    canvasHandles.current[page]?.clear();
    setInkPages((prev) => ({ ...prev, [page]: [] }));
  }, []);

  const handleUploadOfferPdf = useCallback(
    async (file: File) => {
      if (!offer || uploadingOffer) return;
      setUploadingOffer(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const uploadRes = await fetch("/api/hrm/onboarding/job-offer/upload", {
          method: "POST",
          body: form,
        });
        const uploadBody = (await uploadRes.json().catch(() => null)) as {
          success?: boolean;
          message?: string;
          data?: { id?: string };
        } | null;
        const fileId = uploadBody?.data?.id;
        if (!uploadRes.ok || !uploadBody?.success || typeof fileId !== "string") {
          toast.error(uploadBody?.message ?? "Offer PDF upload failed");
          return;
        }

        const patchRes = await fetch(
          `/api/hrm/onboarding/job-offer/${offer.id}/offer`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pdf_file: fileId }),
          }
        );
        const patchBody = (await patchRes.json().catch(() => null)) as {
          success?: boolean;
          message?: string;
        } | null;
        if (!patchRes.ok || !patchBody?.success) {
          toast.error(patchBody?.message ?? "Could not attach the offer PDF");
          return;
        }

        toast.success("Offer PDF uploaded");
        onOfferChanged?.();
      } catch {
        toast.error("Offer PDF upload failed");
      } finally {
        setUploadingOffer(false);
      }
    },
    [offer, onOfferChanged, uploadingOffer]
  );

  const handleOfferFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (file) void handleUploadOfferPdf(file);
  };

  const sign = useSigningOfferSign({
    applicantId: offer?.applicant_id ?? null,
    offerId: offer?.id ?? null,
    locked: offerSigned,
    verdictValid: verdict.valid,
    validityMessage: verdict.reason ?? "This offer is not ready to sign yet",
    pdfDoc: pdf.pdfDoc,
    pages: pdf.pages,
    mergedInk: ink,
    onSigned: onAccepted,
  });

  const commitJump = () => {
    const parsed = Number.parseInt(pageDraft, 10);
    const next = Number.isFinite(parsed)
      ? Math.min(numPages, Math.max(1, parsed))
      : activePage;
    setActivePage(next);
    setPageDraft(String(next));
  };

  return (
    <section className="bg-card overflow-hidden rounded-2xl border border-border/50 shadow-sm">
      <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold sm:text-base">
            Job offer
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {offerLabel(offer)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={offerSigned ? "default" : "outline"}>
            {offer ? offer.status : "missing"}
          </Badge>
          {offer?.pdf_file && (
            <a
              href={`/api/hrm/employee-admin/employee-master-list/assets/${offer.pdf_file}?filename=${encodeURIComponent("Job Offer.pdf")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-8 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted"
              title="View the uploaded offer document"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span>View offer PDF</span>
            </a>
          )}
          {canUploadOfferPdf && (
            <>
              <input
                ref={offerFileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleOfferFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => offerFileInputRef.current?.click()}
                disabled={uploadingOffer}
                className="min-h-8"
                title={
                  offer?.pdf_file
                    ? "Replace the uploaded offer document"
                    : "Upload the offer document as PDF"
                }
              >
                <Upload className="h-3.5 w-3.5 shrink-0" />
                {uploadingOffer
                  ? "Uploading…"
                  : offer?.pdf_file
                    ? "Replace offer PDF"
                    : "Upload offer PDF"}
              </Button>
            </>
          )}
        </div>
      </div>

      {offerTemplate && pdf.pdfError === null ? (
        <div className="space-y-4 px-3 pb-3 sm:px-4">
          <div className="flex flex-nowrap items-center justify-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActivePage(1)}
              disabled={activePage <= 1}
              aria-label="First page"
              className="min-h-8 min-w-8 px-0"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActivePage((p) => Math.max(1, p - 1))}
              disabled={activePage <= 1}
              aria-label="Previous page"
              className="min-h-8 min-w-8 px-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={numPages}
              value={pageDraft}
              onChange={(e) => setPageDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitJump();
                }
                if (e.key === "Escape") setPageDraft(String(activePage));
              }}
              onBlur={commitJump}
              aria-label="Page number"
              className="h-8 w-14 px-1 text-center"
            />
            <span className="text-xs text-muted-foreground">/ {numPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActivePage((p) => Math.min(numPages, p + 1))}
              disabled={activePage >= numPages}
              aria-label="Next page"
              className="min-h-8 min-w-8 px-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActivePage(numPages)}
              disabled={activePage >= numPages}
              aria-label="Last page"
              className="min-h-8 min-w-8 px-0"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <TemplatePageView
              template={offerTemplate}
              page={activePage}
              strokes={inkPages[activePage] ?? []}
              stamps={[]}
              placingStamp={false}
              selectedStampId={null}
              disabled={offerSigned || pdf.pdfDoc === null}
              doc={pdf.pdfDoc}
              docError={pdf.pdfError}
              beyondEnd={pdf.pdfPages !== null && activePage > pdf.pdfPages}
              pageWidth={pdf.pageSizes[activePage]?.width ?? SIGNING_PAGE_W}
              pageHeight={pdf.pageSizes[activePage]?.height ?? SIGNING_PAGE_H}
              onPdfNaturalSize={pdf.handlePdfNaturalSize}
              onStrokesChange={handleStrokesChange}
              onTapPlace={() => undefined}
              onStampMove={() => undefined}
              onStampSelect={() => undefined}
              onStampDelete={() => undefined}
              canvasRef={registerCanvas}
            />
            {!offerSigned && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleClearPage(activePage)}
                className="min-h-8"
                aria-label={`Clear ink on page ${activePage}`}
              >
                Clear page {activePage}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="px-3 pb-3 text-xs text-muted-foreground sm:px-4">
          {offerPdfMissing
            ? offer === null
              ? "The offer document has not been uploaded yet — signing is disabled."
              : "No offer PDF on file — upload the offer document to enable signing."
            : `${pdf.pdfError ?? "The offer PDF could not be loaded"} — signing is disabled.`}
        </p>
      )}

      {!offerPdfMissing && !offerSigned && (
        <div className="flex flex-col gap-2 border-t border-border px-3 py-3 sm:flex-row sm:justify-end sm:px-4">
          <Button
            type="button"
            onClick={() => void sign.handleSign()}
            disabled={sign.signing || !verdict.valid || pdf.pdfDoc === null}
            className="min-h-8 w-full sm:w-auto"
            title={
              verdict.valid
                ? "Sign and file the offer — this accepts it"
                : (verdict.reason ?? "Draw your signature on the offer first")
            }
          >
            {sign.signing ? "Signing…" : "Sign & file offer"}
          </Button>
        </div>
      )}
    </section>
  );
}
