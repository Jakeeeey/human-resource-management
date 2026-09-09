"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  renderPdfPageToCanvas,
  type PdfNaturalSize,
  type SigningPdfDocument,
} from "./pdfDocument";

// PdfPageCanvas.tsx — ONE admin-template PDF page painted 1:1 onto a canvas
// bitmap at exactly `targetWidth` px (height follows page aspect, never
// stretched). The reported bitmap size drives the InkCanvas bitmap plus the
// validity pageSizes upstream, so ink and PDF share ONE pixel grid.
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
  | { kind: "refused"; reason: string };

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

  useEffect(() => {
    let dropped = false;
    const markDropped = () => {
      dropped = !dropped;
    };
    if (beyondEnd) {
      setState({
        kind: "refused",
        reason: `Page ${page} is beyond the end of the template PDF`,
      });
      return markDropped;
    }
    if (docError !== null) {
      setState({ kind: "refused", reason: docError });
      return markDropped;
    }
    if (!doc) {
      setState({ kind: "waiting" });
      return markDropped;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      setState({ kind: "refused", reason: `Page ${page} canvas missing` });
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
        if (dropped) return;
        setState({
          kind: "refused",
          reason:
            err instanceof Error
              ? err.message
              : `Page ${page} could not be painted`,
        });
      });
    return markDropped;
    // onNaturalSize is a stable callback from the surface (size cache write).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, docError, page, beyondEnd, targetWidth]);

  if (state.kind === "refused") {
    return (
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden p-5"
        role="alert"
      >
        <p
          className="max-w-[420px] truncate text-center text-xs text-muted-foreground"
          title={state.reason}
        >
          {state.reason}
        </p>
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
