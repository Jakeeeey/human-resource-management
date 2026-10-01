// signingFlatten.ts — Todo 8 flatten worker (CLIENT-side only).
//
// Runs in the signing surface over the same-origin rendered template:
// finished envelope → `html-to-image.toPng` capture per page (the REAL call —
// the Todo 1b Edge-screenshot stand-in is retired here) → `jspdf` A4 slices
// → filed PDF bytes.
//
// Fidelity contract (Todo 1b verdict upheld): ink offset ≤2px at 1x AND body
// text selectable. Capture runs at pixelRatio 1 over the exact 1:1 signing
// box (`SIGNING_PAGE_W × SIGNING_PAGE_H`), so capture px == ink-model px and
// no rescale drift enters. Selectability comes from the jspdf text layer
// (`doc.text`) written under/over each raster slice — the raster carries the
// ink, the text layer carries the words.
//
// Taint guard: same-origin template only. Any cross-origin `<img>` without
// CORS approval (or canvas already tainted) rejects with a coded reason
// instead of filing a blank/tainted PDF.
//
// Oversize: multi-page rasters that exceed the 10MB `?type=employee_file`
// ceiling reject with a 413-coded reason — NEVER silently downscaled.
//
// Composite-on-view fallback trigger (recorded in Todo 1b, not fired):
// fire iff browser QA shows ink offset >2px at 1x OR body text unselectable
// OR filed PDF >10MB. Fallback = store strokes + template ref, composite at
// view time, file the text-layer PDF only. See `shouldFireCompositeFallback`.

export const FLATTEN_MAX_BYTES = 10 * 1024 * 1024;

export const FLATTEN_INK_OFFSET_PX = 2;

export const FLATTEN_CAPTURE_SCALE = 1;

export interface FlattenTextLine {
  text: string;
  x?: number;
  y?: number;
}

export interface FlattenPageInput {
  /** 1-based page number (A4 slice order). */
  page: number;
  /** Raster from the REAL `toPng` capture (PNG data URL). */
  pngDataUrl: string;
  /** Selectable text layer for this page (template words + envelope label). */
  textLines?: FlattenTextLine[];
}

export interface FlattenPdfResult {
  bytes: Uint8Array;
  pageCount: number;
}

/**
 * Taint-guards one rendered page node before capture. Rejects when a
 * cross-origin image without `crossOrigin="anonymous"` is present (that
 * canvas would taint and `toPng` would throw or blank).
 * @param {HTMLElement} node - Rendered same-origin template page box.
 * @returns {void} Throws with a coded reason when tainted.
 */
export function assertPageNotTainted(node: HTMLElement): void {
  const images = node.querySelectorAll("img");
  for (const img of images) {
    const src = img.getAttribute("src") ?? "";
    if (src.startsWith("data:") || src.startsWith("blob:")) continue;
    if (src !== "" && !src.startsWith(window.location.origin) && !src.startsWith("/")) {
      const crossOrigin = img.getAttribute("crossorigin");
      if (crossOrigin !== "anonymous") {
        throw new Error(
          "TAINTED_CANVAS: cross-origin image without CORS approval — same-origin template only"
        );
      }
    }
  }
}

/**
 * Captures ONE rendered template page with the REAL `html-to-image.toPng`
 * call at 1x (pixelRatio 1 — capture px == ink-model px, ≤2px contract).
 * @param {HTMLElement} node - Rendered same-origin page box to capture.
 * @returns {Promise<string>} PNG data URL of the page.
 */
export async function capturePageToPng(node: HTMLElement): Promise<string> {
  assertPageNotTainted(node);
  const { toPng } = await import("html-to-image");
  try {
    return await toPng(node, {
      pixelRatio: FLATTEN_CAPTURE_SCALE,
      cacheBust: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`CAPTURE_FAILED: html-to-image.toPng rejected — ${message}`);
  }
}

/**
 * Captures every rendered template page, in order.
 * @param {HTMLElement[]} nodes - Page boxes in 1-based page order.
 * @returns {Promise<string[]>} PNG data URLs, one per page.
 */
export async function capturePagesToPng(nodes: HTMLElement[]): Promise<string[]> {
  if (nodes.length === 0) {
    throw new Error("CAPTURE_FAILED: no rendered pages to capture");
  }
  const shots: string[] = [];
  for (const node of nodes) {
    shots.push(await capturePageToPng(node));
  }
  return shots;
}

/**
 * Slices captured page rasters into an A4 PDF with a selectable text layer
 * per page (raster = ink fidelity, `doc.text` = selectability).
 * @param {FlattenPageInput[]} pages - Captured pages in order.
 * @returns {Promise<FlattenPdfResult>} PDF bytes + page count.
 */
export async function flattenPagesToPdf(
  pages: FlattenPageInput[]
): Promise<FlattenPdfResult> {
  if (pages.length === 0) {
    throw new Error("FLATTEN_FAILED: no captured pages to flatten");
  }
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  pages.forEach((entry, index) => {
    if (index > 0) doc.addPage("a4");
    doc.addImage(entry.pngDataUrl, "PNG", 0, 0, pageW, pageH);
    // Selectable text layer: template words + envelope label per page.
    const lines = entry.textLines ?? [];
    let cursorY = 12;
    doc.setFontSize(9);
    for (const line of lines) {
      doc.text(line.text, line.x ?? 12, line.y ?? cursorY);
      if (line.y === undefined) cursorY += 5;
    }
  });

  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  const bytes = new Uint8Array(buffer);
  assertUnderCapOrThrow(bytes.byteLength, pages.length);
  return { bytes, pageCount: pages.length };
}

/**
 * Enforces the 10MB `?type=employee_file` ceiling. Oversize rejects with a
 * 413-coded reason — never silently downscaled.
 * @param {number} byteLength - Filed PDF size in bytes.
 * @param {number} pageCount - Page count for the reason string.
 * @returns {void} Throws when oversize.
 */
export function assertUnderCapOrThrow(byteLength: number, pageCount: number): void {
  if (byteLength > FLATTEN_MAX_BYTES) {
    throw new Error(
      `FILE_TOO_LARGE_413: filed PDF is ${(byteLength / 1024 / 1024).toFixed(2)}MB ` +
        `over ${pageCount} page(s) — exceeds the 10MB 201 ceiling; split or re-file, never downscaled`
    );
  }
}

export interface FlattenFidelityReport {
  inkOffsetPx: number;
  textSelectable: boolean;
  pass: boolean;
  fallback: boolean;
}

/**
 * Re-runs the Todo 1b fidelity measurement against the REAL `toPng`
 * surface: PASS iff ink offset ≤2px at 1x AND text selectable.
 * @param {number} inkOffsetPx - Measured ink offset at 1x.
 * @param {boolean} textSelectable - Whether body text selects in the PDF.
 * @returns {FlattenFidelityReport} Verdict + fallback flag.
 */
export function measureFlattenFidelity(
  inkOffsetPx: number,
  textSelectable: boolean
): FlattenFidelityReport {
  const pass = inkOffsetPx <= FLATTEN_INK_OFFSET_PX && textSelectable;
  return { inkOffsetPx, textSelectable, pass, fallback: !pass };
}

/**
 * Composite-on-view fallback trigger (Todo 1b recorded rule): fire iff ink
 * offset >2px at 1x OR body text unselectable OR filed PDF >10MB.
 * @param {FlattenFidelityReport} report - Fidelity verdict.
 * @param {number} byteLength - Filed PDF size in bytes.
 * @returns {boolean} True when the fallback must fire instead.
 */
export function shouldFireCompositeFallback(
  report: FlattenFidelityReport,
  byteLength: number
): boolean {
  return report.fallback || byteLength > FLATTEN_MAX_BYTES;
}
