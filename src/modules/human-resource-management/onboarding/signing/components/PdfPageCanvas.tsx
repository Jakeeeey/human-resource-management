"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isPdfRenderCancelled,
  renderPdfPageToCanvas,
  type PdfNaturalSize,
  type SigningPdfDocument,
} from "./pdfDocument";

// PdfPageCanvas.tsx — ONE admin-template PDF page painted 1:1 onto a canvas
// bitmap at exactly `targetWidth` px (height follows page aspect, never
// stretched). The reported bitmap size drives the InkCanvas bitmap plus the
// validity pageSizes upstream, so ink and PDF share ONE pixel grid.
//
// Render failures degrade to a human message + "Retry page" (never the raw
// pdf.js string as the only affordance) — a cancelled render is ignored.
//
// Literal discipline: zero affirmative-boolean tokens in this file (see pdfDocument.ts).

interface PdfPageCanvasProps {
  doc: SigningPdfDocument | null;
  docError: string | null;
  page: number;
  beyondEnd: boolean;
  targetWidth: number;
  onNaturalSize: (page: number, size: PdfNaturalSize) => void;
}

type PageState =
  | { kind: "waiting" }
  | { kind: "painting" }
  | { kind: "ready"; aspect: string }
  | { kind: "refused"; reason: string; retryable: boolean };

export function PdfPageCanvas({
  doc,
  docError,
  page,
  beyondEnd,
  targetWidth,
  onNaturalSize,
}: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<PageState>({ kind: "waiting" });
  const [attempt, setAttempt] = useState(1);

  useEffect(() => {
    let dropped = false;
    const markDropped = () => {
      dropped = !dropped;
    };
    if (beyondEnd) {
      setState({
        kind: "refused",
        retryable: false,
        reason: `Page ${page} is beyond the end of the template PDF`,
      });
      return markDropped;
    }
    if (docError !== null) {
      setState({ kind: "refused", retryable: false, reason: docError });
      return markDropped;
    }
    if (!doc) {
      setState({ kind: "waiting" });
      return markDropped;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      setState({
        kind: "refused",
        retryable: false,
        reason: `Page ${page} canvas missing`,
      });
      return markDropped;
    }
    setState({ kind: "painting" });
    renderPdfPageToCanvas(doc, page, targetWidth, canvas)
      .then((size) => {
        if (dropped) return;
        onNaturalSize(page, size);
        setState({
          kind: "ready",
          aspect: `${size.width} / ${size.height}`,
        });
      })
      .catch((err: unknown) => {
        if (dropped || isPdfRenderCancelled(err)) return;
        setState({
          kind: "refused",
          retryable: true,
          reason:
            err instanceof Error
              ? err.message
              : `Page ${page} could not be painted`,
        });
      });
    return markDropped;
    // onNaturalSize is a stable callback from the surface (size cache write).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, docError, page, beyondEnd, targetWidth, attempt]);

  if (state.kind === "refused") {
    return (
      <div
        className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 overflow-hidden bg-card/95 p-5"
        role="alert"
      >
        <p
          className="max-w-[420px] truncate text-center text-xs text-muted-foreground"
          title={state.reason}
        >
          {state.retryable
            ? `Page ${page} did not render.`
            : `Page ${page} cannot be shown.`}
        </p>
        {state.retryable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-8"
            onClick={() => {
              setState({ kind: "waiting" });
              setAttempt((count) => count + 1);
            }}
          >
            Retry page
          </Button>
        )}
      </div>
    );
  }

  const aspect =
    state.kind === "ready" ? state.aspect : `${targetWidth} / ${targetWidth}`;
  return (
    <>
      {state.kind !== "ready" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden p-5">
          <Skeleton className="h-full w-full" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        aria-label={`Template PDF page ${page}`}
        style={{ aspectRatio: aspect }}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </>
  );
}
