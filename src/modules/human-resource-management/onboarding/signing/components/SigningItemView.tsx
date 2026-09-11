"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PaperworkTemplate } from "../../paperwork/types/paperwork-template.schema";
import type { PaperworkItem } from "../types/contracts";
import { requiredZoneCountLabel } from "../signingCopy";
import {
  SIGNING_PAGE_H,
  SIGNING_PAGE_W,
  TemplatePageView,
} from "./TemplatePageView";
import { SignatureStampPicker } from "./SignatureStampPicker";
import type { SignItemResult } from "../providers/signingEnvelopeProvider";
import { useSigningItemModel } from "./useSigningItemModel";

// SigningItemView.tsx — the VIEW for one paperwork_item of an applicant's
// signing set. All signing state/evidence machinery lives in
// `useSigningItemModel`; this file renders the header, the active PDF page
// (one page at a time) with a First/Prev/page-number/Next/Last nav control,
// and the sign action. "Sign & file" is gated SOLELY on the shared
// validity predicate plus the offer gate; a signed item is read-only.
//
// The document body is COLLAPSED by default and only rendered when expanded,
// so a set of heavy PDFs mounts one document's canvases instead of every page
// of every document (S6#7). The surface auto-expands the next unsigned item.

export interface SigningActor {
  role: "hiree" | "hr";
}

interface SigningItemViewProps {
  applicantId: number;
  item: PaperworkItem;
  template: PaperworkTemplate | null;
  /** True while the offer is not accepted — final signing is gated. */
  awaitingOffer: boolean;
  /** True when this item is the next unsigned document to surface. */
  defaultExpanded?: boolean;
  /** Refetches the set from the server (used to reflect partial failures). */
  onReconcile: () => Promise<void>;
  onSigned: (result: SignItemResult) => void;
}

export function SigningItemView({
  applicantId,
  item,
  template,
  awaitingOffer,
  defaultExpanded = false,
  onReconcile,
  onSigned,
}: SigningItemViewProps) {
  const model = useSigningItemModel({
    applicantId,
    item,
    template,
    awaitingOffer,
    onReconcile,
    onSigned,
  });
  const {
    locked,
    verdict,
    validityMessage,
    pdfDoc,
    pdfPages,
    pdfError,
    pages,
    inkPages,
    pageSizes,
    stamps,
    pendingStamp,
    selectedStampId,
    pickerOpen,
    signing,
    placingStamp,
  } = model;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activePage, setActivePage] = useState(1);
  const [pageDraft, setPageDraft] = useState("1");

  const numPages = Math.max(1, pages.length);

  useEffect(() => {
    if (defaultExpanded) setExpanded(true);
  }, [defaultExpanded]);

  useEffect(() => {
    setActivePage((current) => Math.min(numPages, Math.max(1, current)));
  }, [numPages]);

  useEffect(() => {
    setPageDraft(String(activePage));
  }, [activePage]);

  const commitJump = () => {
    const parsed = Number.parseInt(pageDraft, 10);
    const next = Number.isFinite(parsed)
      ? Math.min(numPages, Math.max(1, parsed))
      : activePage;
    setActivePage(next);
    setPageDraft(String(next));
  };

  const title = template?.title ?? `Template ${item.template_id}`;

  return (
    <section
      id={`signing-item-${item.id}`}
      className="bg-card scroll-mt-24 overflow-hidden rounded-2xl border border-border/50 shadow-sm"
    >
      <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              !expanded && "-rotate-90"
            )}
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span
              className="block truncate text-sm font-semibold sm:text-base"
              title={title}
            >
              {title}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {locked
                ? `Signed${item.signed_at ? ` — ${item.signed_at}` : ""}`
                : requiredZoneCountLabel(model.requiredZoneCount)}
            </span>
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={locked ? "default" : "outline"}>
            {locked ? "Signed" : "Pending"}
          </Badge>
          {!locked && (
            <Badge
              variant={
                verdict.valid && !awaitingOffer ? "default" : "secondary"
              }
            >
              {awaitingOffer
                ? "Offer pending"
                : verdict.valid
                  ? "Ready to sign"
                  : "Incomplete"}
            </Badge>
          )}
          {expanded && !locked && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => model.setPickerOpen(true)}
              className="min-h-8 w-full sm:w-auto"
            >
              Capture stamp
            </Button>
          )}
        </div>
      </div>

      {!locked && awaitingOffer && (
        <p className="px-3 pt-2 text-xs text-amber-600 sm:px-4 dark:text-amber-400">
          Accept the job offer first — signatures unlock after the offer is
          accepted.
        </p>
      )}
      {!locked && !verdict.valid && verdict.reason && (
        <p
          className="px-3 pt-2 text-xs text-amber-600 sm:px-4 dark:text-amber-400"
          title={validityMessage}
        >
          Signing blocked: {validityMessage}.
        </p>
      )}
      {pdfError !== null && (
        <p
          className="px-3 pt-2 text-xs text-destructive sm:px-4"
          title={pdfError}
        >
          {pdfError} — signing disabled
        </p>
      )}

      {expanded && (
        <>
          {pendingStamp !== null && !locked && (
            <div className="flex items-center gap-2 px-3 pt-2 sm:px-4">
              <Badge variant="default">Tap a page to place the stamp</Badge>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => model.setPendingStamp(null)}
                className="min-h-8"
              >
                Confirm placement
              </Button>
            </div>
          )}

          {template && (
            <div className="space-y-4 px-3 py-3 sm:px-4">
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
                  template={template}
                  page={activePage}
                  strokes={inkPages[activePage] ?? []}
                  stamps={stamps}
                  placingStamp={placingStamp}
                  selectedStampId={selectedStampId}
                  disabled={locked || pdfDoc === null || pdfError !== null}
                  doc={pdfDoc}
                  docError={pdfError}
                  beyondEnd={pdfPages !== null && activePage > pdfPages}
                  pageWidth={pageSizes[activePage]?.width ?? SIGNING_PAGE_W}
                  pageHeight={pageSizes[activePage]?.height ?? SIGNING_PAGE_H}
                  onPdfNaturalSize={model.handlePdfNaturalSize}
                  onStrokesChange={model.handleStrokesChange}
                  onTapPlace={model.handleTapPlace}
                  onStampMove={model.handleStampMove}
                  onStampSelect={model.setSelectedStampId}
                  onStampDelete={model.handleStampDelete}
                  canvasRef={model.registerCanvas}
                />
                {!locked && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => model.handleClearPage(activePage)}
                    className="min-h-8"
                    aria-label={`Clear ink on page ${activePage}`}
                  >
                    Clear page {activePage}
                  </Button>
                )}
              </div>
            </div>
          )}

          {!locked && (
            <div className="flex flex-col gap-2 border-t border-border px-3 py-3 sm:flex-row sm:justify-end sm:px-4">
              <Button
                type="button"
                onClick={() => void model.handleSign()}
                disabled={signing || !verdict.valid || pdfDoc === null || awaitingOffer}
                className="min-h-8 w-full sm:w-auto"
                title={
                  awaitingOffer
                    ? "Accept the job offer first — signatures unlock after acceptance"
                    : verdict.valid
                      ? "Sign and file this document"
                      : validityMessage
                }
              >
                {signing ? "Signing…" : "Sign & file document"}
              </Button>
            </div>
          )}
        </>
      )}

      <SignatureStampPicker
        open={pickerOpen}
        capturing={false}
        onClose={() => model.setPickerOpen(false)}
        onCapture={model.handleCapture}
      />
    </section>
  );
}
