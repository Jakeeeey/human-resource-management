import type { SigningInk } from "./signingStrokes";
import { paintStroke } from "./signingStrokes";
import {
  renderPdfPageToCanvas,
  type SigningPdfDocument,
} from "./components/pdfDocument";
import { flattenPagesToPdf } from "./signingFlatten";

// signingItemPdf.ts — builds the filed PDF for ONE signed paperwork_item.
//
// Why this exists: the per-item signing endpoint persists a real `pdf_file`
// UUID, so the surface must turn the on-screen template + merged ink into
// PDF bytes before upload. Each page is re-rendered from the SAME pdf.js
// document at the signing bitmap width and the merged ink is painted on top
// through the shared `paintStroke` path, so the filed raster matches the
// preview pixel-for-pixel (zone outlines are never baked in). The raster set
// then flows through the reusable `flattenPagesToPdf` (jspdf + 10MB cap).

export interface SignedItemPdfInput {
  doc: SigningPdfDocument;
  pages: number[];
  targetWidth: number;
  ink: SigningInk;
}

/**
 * Composites every page (template raster + merged ink) and flattens to PDF.
 * @param {SignedItemPdfInput} input - Open document, page numbers, bitmap width, merged ink.
 * @returns {Promise<Uint8Array>} Filed PDF bytes (cap-checked by the flatten util).
 */
export async function renderSignedItemPdf(
  input: SignedItemPdfInput
): Promise<Uint8Array> {
  const captured: { page: number; pngDataUrl: string }[] = [];
  for (const page of input.pages) {
    const canvas = document.createElement("canvas");
    await renderPdfPageToCanvas(input.doc, page, input.targetWidth, canvas);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const strokes =
        input.ink.pages.find((entry) => entry.page === page)?.strokes ?? [];
      for (const stroke of strokes) paintStroke(ctx, stroke);
    }
    captured.push({ page, pngDataUrl: canvas.toDataURL("image/png") });
  }
  const { bytes } = await flattenPagesToPdf(captured);
  return bytes;
}
