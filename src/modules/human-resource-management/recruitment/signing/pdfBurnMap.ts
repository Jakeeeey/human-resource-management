// pdfBurnMap.ts — Todo 18 pure mapping for the server-side pdf-lib burn.
//
// Import-safe (no DOM, no canvas, no pdf-lib): fraction ↔ PDF-point math,
// hex → PDF-rgb, and stamp-rect placement shared by the burn core (server)
// and the harness. The Todo 17 renderer owns the bitmap grid — ink points
// live in page-bitmap px, zones live in fractions, PDF pages live in points
// (origin bottom-left). Fractions are the bridge both directions.

export interface BurnPageSize {
  width: number;
  height: number;
}

export interface BurnPdfPoint {
  x: number;
  y: number;
}

export interface BurnPdfColor {
  red: number;
  green: number;
  blue: number;
}

export interface BurnStampRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Stamp preview width as a fraction of the page (mirrors TemplatePageView). */
export const BURN_STAMP_WIDTH_FRACTION = 0.375;

/** Stamp preview aspect (mirrors TemplatePageView `600 / 180`). */
export const BURN_STAMP_ASPECT_W = 600;
export const BURN_STAMP_ASPECT_H = 180;

/** Fallback ink color (the surface default `#111827`) as PDF rgb. */
export const BURN_FALLBACK_COLOR: BurnPdfColor = {
  red: 0x11 / 255,
  green: 0x18 / 255,
  blue: 0x27 / 255,
};

function isUsableSize(size: BurnPageSize | null | undefined): size is BurnPageSize {
  return (
    !!size &&
    typeof size.width === "number" &&
    typeof size.height === "number" &&
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  );
}

/**
 * Maps one ink point (page-bitmap px) to PDF points. The y-axis flips:
 * bitmap origin is top-left, PDF origin is bottom-left.
 * @param {number} px - Ink x in bitmap px.
 * @param {number} py - Ink y in bitmap px.
 * @param {BurnPageSize} bitmap - Renderer-owned bitmap size for the page.
 * @param {BurnPageSize} pdf - PDF page size in points.
 * @returns {BurnPdfPoint} PDF-space point, or null when a size is unusable.
 */
export function bitmapPointToPdfPoint(
  px: number,
  py: number,
  bitmap: BurnPageSize,
  pdf: BurnPageSize
): BurnPdfPoint | null {
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  if (!isUsableSize(bitmap) || !isUsableSize(pdf)) return null;
  const fx = px / bitmap.width;
  const fy = py / bitmap.height;
  return { x: fx * pdf.width, y: pdf.height - fy * pdf.height };
}

/**
 * Scales a bitmap-px stroke width into PDF points (uniform x-scale).
 * Clamped so hairlines stay visible and runaway widths stay drawable.
 * @param {number} widthPx - Stroke width in bitmap px.
 * @param {BurnPageSize} bitmap - Renderer-owned bitmap size for the page.
 * @param {BurnPageSize} pdf - PDF page size in points.
 * @returns {number} Thickness in points.
 */
export function scaleStrokeWidthToPdf(
  widthPx: number,
  bitmap: BurnPageSize,
  pdf: BurnPageSize
): number {
  if (!Number.isFinite(widthPx) || widthPx <= 0) return 1;
  if (!isUsableSize(bitmap) || !isUsableSize(pdf)) return 1;
  const scaled = widthPx * (pdf.width / bitmap.width);
  return Math.max(0.25, Math.min(24, scaled));
}

/**
 * Parses a `#rgb`/`#rrggbb` CSS color into PDF rgb (0..1). Anything else
 * falls back to the surface default ink — never throws on hiree colors.
 * @param {string} color - CSS color string from the stroke model.
 * @returns {BurnPdfColor} PDF-space color.
 */
export function hexToPdfColor(color: string): BurnPdfColor {
  if (typeof color !== "string") return { ...BURN_FALLBACK_COLOR };
  const hex = color.trim().replace(/^#/, "");
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((digit) => `${digit}${digit}`)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return { ...BURN_FALLBACK_COLOR };
  return {
    red: parseInt(expanded.slice(0, 2), 16) / 255,
    green: parseInt(expanded.slice(2, 4), 16) / 255,
    blue: parseInt(expanded.slice(4, 6), 16) / 255,
  };
}

/**
 * Places a stamp anchor (page fractions, top-left) as a PDF rect. Matches
 * the surface preview: 37.5% page width, 600:180 aspect, y-flipped.
 * @param {number} fx - Stamp anchor x in fractions (0..1).
 * @param {number} fy - Stamp anchor y in fractions (0..1).
 * @param {BurnPageSize} pdf - PDF page size in points.
 * @returns {BurnStampRect} PDF-space rect, or null for bad anchors/sizes.
 */
export function stampAnchorToPdfRect(
  fx: number,
  fy: number,
  pdf: BurnPageSize
): BurnStampRect | null {
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;
  if (!isUsableSize(pdf)) return null;
  const width = BURN_STAMP_WIDTH_FRACTION * pdf.width;
  const height = (width * BURN_STAMP_ASPECT_H) / BURN_STAMP_ASPECT_W;
  const x = fx * pdf.width;
  const top = fy * pdf.height;
  return { x, y: pdf.height - top - height, width, height };
}
