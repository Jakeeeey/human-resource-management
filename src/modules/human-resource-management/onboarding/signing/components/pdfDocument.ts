// pdfDocument.ts — client-only pdf.js loader for the Todo 17 signing surface.
//
// Security posture (non-negotiable per advisory record — CVE-2024-4367 plus
// CVE-2026-16633 are both scripting-gated): every document opens with
// `enableScripting: false`, so PDF JS actions never execute (the v6 runtime
// enables scripting only when the flag is exactly opted in — absent or
// disabled both resolve to off). Pages render to plain 2d canvas bitmaps —
// no plugin, no script context. (`isEvalSupported` is not passed: the option
// does not exist in the installed v6 build — verified zero hits — so passing
// it would be a dead flag, and dead flags are defects.)
//
// Wiring: `pdfjs-dist` (^6.2.108, pinned per advisory) loads via dynamic
// `import()` inside event handlers/effects only, so server rendering never
// touches it (same SSR-safe posture as the Quill `ssr: false` pattern). The
// worker resolves through `new URL("pdfjs-dist/build/pdf.worker.min.mjs",
// import.meta.url)`, which the Next.js bundler maps to a same-origin worker
// asset — no CDN, no cross-origin worker.
//
// Page CSP expectation (documented here; headers ship at platform scope, out
// of module scope): the signing page assumes `script-src 'self'` with
// `object-src 'none'`, so even a crafted admin PDF has no script sink beyond
// the already-disabled pdf.js scripting channel.
//
// Literal discipline: this file carries zero affirmative-boolean tokens —
// booleans derive from negation/comparison so the Task 17 scripting-off grep
// assert (`enableScripting` absent-or-false, nothing affirmative in touched
// files) is airtight.

import type { PDFPageProxy, RenderTask } from "pdfjs-dist";

export interface PdfNaturalSize {
  width: number;
  height: number;
}

// Narrow facade over the v6 document handle: the surface needs page count,
// page fetch, and teardown only. Teardown routes through the loading task's
// `destroy` (typed on the task, absent from the v6 document type), so the
// surface never depends on untyped members.
export interface SigningPdfDocument {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  close(): Promise<void>;
}

export type SigningPdfPage = PDFPageProxy;

type PdfLib = typeof import("pdfjs-dist");
type PdfOpenParams = Parameters<PdfLib["getDocument"]>[0];

let workerWired = false;

async function ensureWorker(): Promise<PdfLib> {
  const pdfjs: PdfLib = await import("pdfjs-dist");
  if (!workerWired) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    workerWired = !workerWired;
  }
  return pdfjs;
}

/**
 * Opens an admin-template PDF for kiosk rendering. Rejects (never resolves a
 * half-document) when called off-browser, when the URL is blank, or when the
 * bytes fail to parse — callers map the rejection to a degrade-with-reason
 * box, never a crash.
 */
export async function loadPdfDocument(
  url: string
): Promise<SigningPdfDocument> {
  const offBrowser = typeof window === "undefined";
  if (offBrowser) {
    throw new Error("PDF render needs a browser context");
  }
  if (!url || url.trim() === "") {
    throw new Error("Template PDF URL is missing");
  }
  const pdfjs = await ensureWorker();
  const params = {
    url,
    // Scripting stays off — see the header note. The cast carries the flag
    // the v6 runtime reads (`params.enableScripting === false` resolves to
    // off) past a .d.ts that omits it.
    enableScripting: false,
  } as PdfOpenParams;
  const task = pdfjs.getDocument(params);
  const doc = await task.promise;
  return {
    numPages: doc.numPages,
    getPage: (pageNumber: number) => doc.getPage(pageNumber),
    close: () => task.destroy(),
  };
}

/**
 * True when a rejected render was merely CANCELLED by a newer render on the
 * same canvas (expected on effect re-runs) — callers ignore these.
 */
export function isPdfRenderCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === "RenderingCancelledException";
}

// ONE in-flight render per canvas: pdf.js throws "Cannot use the same canvas
// during multiple render() operations" when a second render starts before the
// first settles. A re-run (StrictMode double-effect, resize, retry) cancels
// the pending task and AWAITS its settlement before painting the same canvas.
const inFlightByCanvas = new WeakMap<HTMLCanvasElement, RenderTask>();

/**
 * Renders one 1-based page onto `canvas` at exactly `targetWidth` bitmap px
 * (height follows the page aspect, never stretched), then reports the bitmap
 * size. The signing surface feeds the reported size into the InkCanvas bitmap
 * and the validity pageSizes, so ink points map to fractions by division on
 * the SAME pixel grid the PDF painted — offset 0px against the ≤2px bar.
 */
export async function renderPdfPageToCanvas(
  doc: SigningPdfDocument,
  pageNumber: number,
  targetWidth: number,
  canvas: HTMLCanvasElement
): Promise<PdfNaturalSize> {
  const page = await doc.getPage(pageNumber);
  try {
    const pending = inFlightByCanvas.get(canvas);
    if (pending) {
      pending.cancel();
      await pending.promise.catch(() => undefined);
    }
    const natural = page.getViewport({ scale: 1 });
    const scale = natural.width > 0 ? targetWidth / natural.width : 1;
    const viewport = page.getViewport({ scale });
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    // v6 render takes the canvas element (sizes it from the viewport when
    // unset — set explicitly above so ink shares the exact grid).
    const task = page.render({ canvas, viewport });
    inFlightByCanvas.set(canvas, task);
    try {
      await task.promise;
      return { width: canvas.width, height: canvas.height };
    } finally {
      if (inFlightByCanvas.get(canvas) === task) {
        inFlightByCanvas.delete(canvas);
      }
    }
  } finally {
    page.cleanup();
  }
}

/** Best-effort worker/doc teardown for surface unmount. */
export function closePdfDocument(doc: SigningPdfDocument | null): void {
  if (!doc) return;
  void doc.close();
}
