"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PaperworkTemplate } from "../../paperwork/types/paperwork-template.schema";
import { isPaperworkValid } from "../../paperwork/paperworkValidity";
import type { PaperworkItem } from "../types/contracts";
import type { InkCanvasHandle } from "../InkCanvas";
import {
  parseInk,
  serializeInk,
  type SigningInk,
  type SigningStroke,
} from "../signingStrokes";
import { mergeStampsIntoInk } from "../signingStamps";
import {
  closePdfDocument,
  loadPdfDocument,
  type PdfNaturalSize,
  type SigningPdfDocument,
} from "./pdfDocument";
import { renderSignedItemPdf } from "../signingItemPdf";
import { buildFilingFilename } from "../signingVault";
import { uploadFiledPdf } from "../signingFiling";
import {
  SIGNING_PAGE_H,
  SIGNING_PAGE_W,
  TemplatePageView,
} from "./TemplatePageView";
import { SignatureStampPicker, type CapturedStamp } from "./SignatureStampPicker";
import {
  useSigningEnvelopeFetch,
  type SignItemResult,
} from "../providers/signingEnvelopeProvider";

// SigningItemView.tsx — one paperwork_item of an applicant's signing set.
// Renders the template PDF page(s) 1:1 with a per-page ink overlay; stamp
// capture/tap/drag reused from the surface stack. "Sign & file" is gated
// SOLELY on the shared validity predicate, then composites the page raster +
// merged ink to PDF bytes, uploads them through the existing employee-file
// route, and PATCHes the todo-12 per-item endpoint with `{ strokes, pdf_file }`.
// A signed item is read-only — its persisted strokes rehydrate the preview.

export interface SigningActor {
  role: "hiree" | "hr";
}

interface PlacedStamp {
  id: string;
  page: number;
  x: number;
  y: number;
  strokes: SigningStroke[];
  pngUrl?: string;
}

interface SigningItemViewProps {
  applicantId: number;
  item: PaperworkItem;
  template: PaperworkTemplate | null;
  onSigned: (result: SignItemResult) => void;
}

function parseInkSafe(raw: string | null): SigningInk | null {
  if (!raw || raw.trim() === "") return null;
  try {
    return parseInk(raw);
  } catch {
    return null;
  }
}

function pdfSourceFor(template: PaperworkTemplate | null): {
  url: string | null;
  reason: string | null;
} {
  if (!template) {
    return { url: null, reason: "This template is no longer in the registry" };
  }
  if (template.source !== "pdf") {
    return {
      url: null,
      reason: "HTML templates are retired — link a PDF file before signing",
    };
  }
  if (!template.pdf_file) {
    return { url: null, reason: "Template PDF is not linked yet" };
  }
  return {
    url: `/api/hrm/onboarding/paperwork-templates/${template.id}/pdf`,
    reason: null,
  };
}

export function SigningItemView({
  applicantId,
  item,
  template,
  onSigned,
}: SigningItemViewProps) {
  const { signPaperworkItem } = useSigningEnvelopeFetch();
  const pdfSource = useMemo(() => pdfSourceFor(template), [template]);
  const [pdfDoc, setPdfDoc] = useState<SigningPdfDocument | null>(null);
  const [pdfPages, setPdfPages] = useState<number | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfSizes, setPdfSizes] = useState<Record<number, PdfNaturalSize>>({});
  const [inkPages, setInkPages] = useState<Record<number, SigningStroke[]>>(() => {
    const seed: Record<number, SigningStroke[]> = {};
    const content = parseInkSafe(item.strokes);
    for (const page of content?.pages ?? []) {
      seed[page.page] = Array.isArray(page.strokes) ? page.strokes : [];
    }
    return seed;
  });
  const [stamps, setStamps] = useState<PlacedStamp[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingStamp, setPendingStamp] = useState<CapturedStamp | null>(null);
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const canvasHandles = useRef<Record<number, InkCanvasHandle | null>>({});

  const locked = item.status === "signed";

  useEffect(() => {
    let dropped = false;
    let doc: SigningPdfDocument | null = null;
    setPdfDoc(null);
    setPdfPages(null);
    setPdfError(null);
    setPdfSizes({});
    if (pdfSource.url === null) {
      setPdfError(pdfSource.reason);
      return () => {
        dropped = !dropped;
      };
    }
    loadPdfDocument(pdfSource.url)
      .then((loaded) => {
        if (dropped) {
          closePdfDocument(loaded);
          return;
        }
        doc = loaded;
        setPdfDoc(loaded);
        setPdfPages(loaded.numPages);
      })
      .catch((err: unknown) => {
        if (dropped) return;
        setPdfError(
          err instanceof Error ? err.message : "Template PDF could not be loaded"
        );
      });
    return () => {
      dropped = !dropped;
      closePdfDocument(doc);
    };
  }, [pdfSource]);

  const pageCount = useMemo(() => {
    const zones = template?.zones ?? [];
    const zoneMax = Math.max(1, ...zones.map((zone) => zone.page), 1);
    return pdfPages === null ? zoneMax : Math.max(zoneMax, pdfPages);
  }, [template, pdfPages]);
  const pages = useMemo(
    () => Array.from({ length: pageCount }, (_, i) => i + 1),
    [pageCount]
  );

  const ink: SigningInk = useMemo(
    () => ({
      pages: pages.map((page) => ({ page, strokes: inkPages[page] ?? [] })),
    }),
    [pages, inkPages]
  );

  const pageSizes = useMemo(() => {
    const sizes: Record<number, { width: number; height: number }> = {};
    for (const page of pages) {
      const natural = pdfSizes[page];
      sizes[page] =
        natural !== undefined
          ? { width: natural.width, height: natural.height }
          : { width: SIGNING_PAGE_W, height: SIGNING_PAGE_H };
    }
    return sizes;
  }, [pages, pdfSizes]);

  const merged = useMemo(
    () => mergeStampsIntoInk(ink, stamps, pageSizes),
    [ink, stamps, pageSizes]
  );
  const verdict = useMemo(
    () => isPaperworkValid(template?.zones ?? [], merged, pageSizes),
    [template, merged, pageSizes]
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

  const handlePdfNaturalSize = useCallback(
    (page: number, size: PdfNaturalSize) => {
      setPdfSizes((prev) =>
        prev[page] !== undefined ? prev : { ...prev, [page]: size }
      );
    },
    []
  );

  const handleTapPlace = useCallback(
    (page: number, x: number, y: number) => {
      if (!pendingStamp) return;
      const stamp: PlacedStamp = {
        id: `stamp-${Date.now().toString(36)}-${stamps.length + 1}`,
        page,
        x,
        y,
        strokes: pendingStamp.strokes,
        pngUrl: pendingStamp.pngUrl,
      };
      setStamps((prev) => [...prev, stamp]);
      setSelectedStampId(stamp.id);
    },
    [pendingStamp, stamps.length]
  );

  const handleStampMove = useCallback((id: string, x: number, y: number) => {
    setStamps((prev) =>
      prev.map((stamp) => (stamp.id === id ? { ...stamp, x, y } : stamp))
    );
  }, []);

  const handleStampDelete = useCallback((id: string) => {
    setStamps((prev) => prev.filter((stamp) => stamp.id !== id));
    setSelectedStampId((cur) => (cur === id ? null : cur));
  }, []);

  const handleCapture = useCallback((captured: CapturedStamp) => {
    setPendingStamp(captured);
    setPickerOpen(false);
    toast.success("Stamp captured — tap a page to place it");
  }, []);

  const handleClearPage = useCallback((page: number) => {
    canvasHandles.current[page]?.clear();
    setInkPages((prev) => ({ ...prev, [page]: [] }));
  }, []);

  const handleSign = useCallback(async () => {
    if (locked || signing) return;
    if (!template) {
      toast.error("This template is no longer in the registry");
      return;
    }
    if (!verdict.valid) {
      toast.error(verdict.reason ?? "This document is not ready to sign");
      return;
    }
    if (pdfDoc === null) {
      toast.error("Wait for the template PDF to finish loading");
      return;
    }
    setSigning(true);
    try {
      const bytes = await renderSignedItemPdf({
        doc: pdfDoc,
        pages,
        targetWidth: SIGNING_PAGE_W,
        ink: merged,
      });
      const filename = buildFilingFilename(
        `applicant-${applicantId}-item-${item.id}`,
        1
      );
      const fileId = await uploadFiledPdf(bytes, filename);
      const result = await signPaperworkItem(
        item.id,
        serializeInk(merged),
        fileId
      );
      onSigned(result);
      toast.success(`${template.title} signed and filed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signing failed");
    } finally {
      setSigning(false);
    }
  }, [
    locked,
    signing,
    template,
    verdict,
    pdfDoc,
    pages,
    merged,
    applicantId,
    item.id,
    signPaperworkItem,
    onSigned,
  ]);

  return (
    <section className="bg-card overflow-hidden rounded-2xl border border-border/50 shadow-sm">
      <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <h3
            className="truncate text-sm font-semibold sm:text-base"
            title={template?.title ?? `Template ${item.template_id}`}
          >
            {template?.title ?? `Template ${item.template_id}`}
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {locked
              ? `Signed${item.signed_at ? ` — ${item.signed_at}` : ""}`
              : `${(template?.zones ?? []).filter((zone) => zone.required).length} required zone(s)`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={locked ? "default" : "outline"}>
            {locked ? "Signed" : "Pending"}
          </Badge>
          {!locked && (
            <Badge variant={verdict.valid ? "default" : "secondary"}>
              {verdict.valid ? "Ready to sign" : "Incomplete"}
            </Badge>
          )}
          {!locked && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
              className="min-h-8 w-full sm:w-auto"
            >
              Capture stamp
            </Button>
          )}
        </div>
      </div>

      {!locked && !verdict.valid && verdict.reason && (
        <p
          className="px-3 pt-2 text-xs text-amber-600 sm:px-4 dark:text-amber-400"
          title={verdict.reason}
        >
          Signing blocked: {verdict.reason}
        </p>
      )}
      {pdfError !== null && (
        <p className="px-3 pt-2 text-xs text-destructive sm:px-4" title={pdfError}>
          {pdfError} — signing disabled
        </p>
      )}
      {pendingStamp !== null && !locked && (
        <div className="flex items-center gap-2 px-3 pt-2 sm:px-4">
          <Badge variant="default">Tap a page to place the stamp</Badge>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setPendingStamp(null)}
            className="min-h-8"
          >
            Confirm placement
          </Button>
        </div>
      )}

      {template && (
        <div className="space-y-4 px-3 py-3 sm:px-4">
          {pages.map((page) => (
            <div key={page} className="space-y-2">
              <TemplatePageView
                template={template}
                page={page}
                strokes={inkPages[page] ?? []}
                stamps={stamps}
                placingStamp={pendingStamp !== null && !locked}
                selectedStampId={selectedStampId}
                disabled={locked || pdfDoc === null || pdfError !== null}
                doc={pdfDoc}
                docError={pdfError}
                beyondEnd={pdfPages !== null && page > pdfPages}
                pageWidth={pageSizes[page]?.width ?? SIGNING_PAGE_W}
                pageHeight={pageSizes[page]?.height ?? SIGNING_PAGE_H}
                onPdfNaturalSize={handlePdfNaturalSize}
                onStrokesChange={handleStrokesChange}
                onTapPlace={handleTapPlace}
                onStampMove={handleStampMove}
                onStampSelect={setSelectedStampId}
                onStampDelete={handleStampDelete}
                canvasRef={registerCanvas}
              />
              {!locked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleClearPage(page)}
                  className="min-h-8"
                  aria-label={`Clear ink on page ${page}`}
                >
                  Clear page {page}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {!locked && (
        <div className="flex flex-col gap-2 border-t border-border px-3 py-3 sm:flex-row sm:justify-end sm:px-4">
          <Button
            type="button"
            onClick={() => void handleSign()}
            disabled={signing || !verdict.valid || pdfDoc === null}
            className="min-h-8 w-full sm:w-auto"
            title={
              verdict.valid
                ? "Sign and file this document"
                : (verdict.reason ?? "Incomplete")
            }
          >
            {signing ? "Signing…" : "Sign & file document"}
          </Button>
        </div>
      )}

      <SignatureStampPicker
        open={pickerOpen}
        capturing={false}
        onClose={() => setPickerOpen(false)}
        onCapture={handleCapture}
      />
    </section>
  );
}
