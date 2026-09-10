"use client";

import { useRef } from "react";
import { InkCanvas } from "../InkCanvas";
import type { InkCanvasHandle } from "../InkCanvas";
import type { PaperworkTemplate, PaperworkZone } from "../../paperwork/types/paperwork-template.schema";
import type { SigningStamp } from "../signingStamps";
import type { SigningStroke } from "../signingStrokes";

import { PdfPageCanvas } from "./PdfPageCanvas";
import type {
  PdfNaturalSize,
  SigningPdfDocument,
} from "./pdfDocument";

// TemplatePageView.tsx — ONE admin-template PDF page rendered 1:1 with a
// per-page `InkCanvas` overlay in exact alignment (our DOM, no plugin): the
// PDF bitmap, the required/optional zone outlines, the ink canvas, and placed
// signature stamps all share ONE relatively-positioned box at the resolved
// page bitmap size, so ink points map to fractions by division and the Todo 6
// predicate's fraction mapping holds.
//
// PDF-ONLY (Todo 17, owner order 2026-09-09): the Quill-HTML render branch is
// deleted — dead code is a defect. Non-PDF templates degrade to a reason box
// with ink disabled (the surface owns that gate); nothing here parses HTML.
//
// Literal discipline: zero affirmative-boolean tokens in this file (see pdfDocument.ts).

export const SIGNING_PAGE_W = 800;
export const SIGNING_PAGE_H = 1050;

interface TemplatePageViewProps {
  template: PaperworkTemplate;
  page: number;
  strokes: SigningStroke[];
  stamps: (SigningStamp & { pngUrl?: string })[];
  placingStamp: boolean;
  selectedStampId: string | null;
  disabled?: boolean;
  doc: SigningPdfDocument | null;
  docError: string | null;
  beyondEnd: boolean;
  pageWidth: number;
  pageHeight: number;
  onPdfNaturalSize: (page: number, size: PdfNaturalSize) => void;
  onStrokesChange: (page: number, strokes: SigningStroke[]) => void;
  onTapPlace: (page: number, x: number, y: number) => void;
  onStampMove: (id: string, x: number, y: number) => void;
  onStampSelect: (id: string | null) => void;
  onStampDelete: (id: string) => void;
  canvasRef: (page: number, handle: InkCanvasHandle | null) => void;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function TemplatePageView({
  template,
  page,
  strokes,
  stamps,
  placingStamp,
  selectedStampId,
  disabled = false,
  doc,
  docError,
  beyondEnd,
  pageWidth,
  pageHeight,
  onPdfNaturalSize,
  onStrokesChange,
  onTapPlace,
  onStampMove,
  onStampSelect,
  onStampDelete,
  canvasRef,
}: TemplatePageViewProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const pageZones: PaperworkZone[] = (template.zones ?? []).filter(
    (zone) => zone.page === page
  );
  const pageStamps = stamps.filter((stamp) => stamp.page === page);

  const toFraction = (clientX: number, clientY: number) => {
    const el = boxRef.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return null;
    return {
      x: clamp01((clientX - box.left) / box.width),
      y: clamp01((clientY - box.top) / box.height),
    };
  };

  const handleBoxTap = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!placingStamp || disabled) return;
    if ((e.target as HTMLElement).closest("[data-stamp-id]")) return;
    const point = toFraction(e.clientX, e.clientY);
    if (!point) return;
    onTapPlace(page, point.x, point.y);
  };

  const handleStampPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    stamp: SigningStamp & { pngUrl?: string }
  ) => {
    if (disabled) return;
    e.stopPropagation();
    onStampSelect(stamp.id);
    const point = toFraction(e.clientX, e.clientY);
    if (!point) return;
    dragRef.current = { id: stamp.id, dx: point.x - stamp.x, dy: point.y - stamp.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleStampPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = toFraction(e.clientX, e.clientY);
    if (!point) return;
    onStampMove(drag.id, clamp01(point.x - drag.dx), clamp01(point.y - drag.dy));
  };

  const handleStampPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="w-full overflow-hidden">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Page {page}</span>
        {pageZones.length > 0 && (
          <span className="truncate text-xs text-muted-foreground" title={pageZones.map((z) => z.id).join(", ")}>
            {pageZones.filter((z) => z.required).length} required zone
            {pageZones.filter((z) => z.required).length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {/* ONE box, ONE size: body + zones + ink + stamps share it (1:1). */}
      <div
        ref={boxRef}
        data-signing-page-box={page}
        onPointerDown={handleBoxTap}
        className={`relative w-full overflow-hidden rounded-lg border border-border bg-card ${
          placingStamp ? "cursor-copy" : ""
        }`}
        style={{ aspectRatio: `${pageWidth} / ${pageHeight}` }}
        aria-label={`Signing page ${page}${placingStamp ? " — tap to place signature stamp" : ""}`}
      >
        <PdfPageCanvas
          doc={doc}
          docError={docError}
          page={page}
          beyondEnd={beyondEnd}
          targetWidth={SIGNING_PAGE_W}
          onNaturalSize={onPdfNaturalSize}
        />
        {pageZones.map((zone) => (
          <div
            key={zone.id}
            className={`pointer-events-none absolute rounded-sm border-2 ${
              zone.required ? "border-amber-500/70" : "border-emerald-500/70"
            }`}
            style={{
              left: `${zone.rect.x * 100}%`,
              top: `${zone.rect.y * 100}%`,
              width: `${zone.rect.w * 100}%`,
              height: `${zone.rect.h * 100}%`,
            }}
            title={`${zone.id} — ${zone.required ? "required" : "optional"}`}
          />
        ))}
        <InkCanvas
          ref={(handle) => canvasRef(page, handle)}
          page={page}
          value={strokes}
          onChange={(next) => onStrokesChange(page, next)}
          width={pageWidth}
          height={pageHeight}
          disabled={disabled}
          showClear={false}
          transparent
          className="absolute inset-0"
          ariaLabel={`Ink overlay for page ${page}`}
        />
        {pageStamps.map((stamp) => (
          <div
            key={stamp.id}
            data-stamp-id={stamp.id}
            onPointerDown={(e) => handleStampPointerDown(e, stamp)}
            onPointerMove={handleStampPointerMove}
            onPointerUp={handleStampPointerUp}
            onPointerCancel={handleStampPointerUp}
            className={`absolute min-h-8 min-w-8 touch-none ${
              selectedStampId === stamp.id ? "ring-2 ring-primary" : ""
            }`}
            style={{
              left: `${stamp.x * 100}%`,
              top: `${stamp.y * 100}%`,
              width: "37.5%",
              aspectRatio: "600 / 180",
            }}
            title="Drag to move — confirm placement before Finish"
          >
            {stamp.pngUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data-URL stamp preview (never a remote asset)
              <img
                src={stamp.pngUrl}
                alt="Signature stamp"
                className="pointer-events-none h-full w-full dark:invert"
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-primary bg-primary/10">
                <span className="text-[10px] text-muted-foreground">signature</span>
              </div>
            )}
            {selectedStampId === stamp.id && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStampDelete(stamp.id);
                }}
                className="absolute -right-2 -top-2 flex min-h-8 min-w-8 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground"
                aria-label={`Remove stamp ${stamp.id}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
