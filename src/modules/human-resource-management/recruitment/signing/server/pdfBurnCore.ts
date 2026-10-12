// pdfBurnCore.ts — Todo 18 server-side pdf-lib burn core (Node runtime only).
//
// TRUST BOUNDARY (load-bearing, not decorative): `templateBytes` MUST be the
// admin-template bytes fetched server-side from Directus `/assets` (token
// stays server-side). NEVER pass hiree-uploaded PDF bytes to `PDFDocument.load`
// — pdf-lib's parser carries unpatched DoS-class bugs (decompression bombs,
// XRef-width abuse, JPEG-parser faults), so untrusted bytes never reach it.
// Grep-assert: `PDFDocument.load` appears exactly once in product code, in
// this file, fed by the `templateBytes` parameter the pdf-burn route fills
// ONLY from the Directus asset fetch.
//
// Parse-DoS posture: byte-cap before parse, wall-clock timeout around
// load/save, point-count cap on ink, per-PNG cap on stamp images. Oversize
// or corrupt input rejects with a coded reason — never a filed PDF.
//
// Import-safe for Node (no DOM, no Next): the harness imports this module
// directly against the installed `pdf-lib`.

import { LineCapStyle, PDFDocument, rgb } from "pdf-lib";

import type { SigningInk, SigningStroke } from "../signingStrokes";
import { parseInk } from "../signingStrokes";
import { mergeStampsIntoInk, type SigningStamp } from "../signingStamps";
import {
  bitmapPointToPdfPoint,
  hexToPdfColor,
  scaleStrokeWidthToPdf,
  stampAnchorToPdfRect,
  type BurnPageSize,
} from "../pdfBurnMap";

/** Admin-template byte ceiling (mirrors the `?type=employee_file` 10MB cap). */
export const PDF_BURN_TEMPLATE_MAX_BYTES = 10 * 1024 * 1024;

/** Filed-PDF byte ceiling (mirrors the `?type=employee_file` 10MB cap). */
export const PDF_BURN_OUTPUT_MAX_BYTES = 10 * 1024 * 1024;

/** Wall-clock guard around `PDFDocument.load` (parse-DoS posture). */
export const PDF_BURN_LOAD_TIMEOUT_MS = 10_000;

/** Wall-clock guard around `pdfDoc.save()`. */
export const PDF_BURN_SAVE_TIMEOUT_MS = 15_000;

/** Per-stamp PNG ceiling (hiree-drawn signature images, small by nature). */
export const PDF_BURN_STAMP_PNG_MAX_BYTES = 2 * 1024 * 1024;

/** Ink point-count ceiling (runaway stroke arrays reject, never hang). */
export const PDF_BURN_MAX_TOTAL_POINTS = 200_000;

export interface BurnStampPngInput {
  stampId: string;
  pngDataUrl: string;
}

export interface BurnTemplatePdfInput {
  /**
   * TRUSTED admin-template bytes ONLY (server-side Directus `/assets` fetch).
   * Never hiree-uploaded bytes.
   */
  templateBytes: Uint8Array;
  /** Locked envelope ink (freehand half of the persisted content document). */
  ink: SigningInk;
  /** Placed stamps from the persisted content document (vector half). */
  stamps?: SigningStamp[];
  /** Renderer-owned bitmap size per 1-based page (fraction bridge). */
  pageSizes: Record<number, BurnPageSize>;
  /** Optional hiree signature PNGs (redundant with stamp vectors). */
  stampPngs?: BurnStampPngInput[];
}

export interface BurnTemplatePdfResult {
  bytes: Uint8Array;
  pageCount: number;
  drawnStrokes: number;
  drawnSegments: number;
  skippedPages: number;
  embeddedPngs: number;
  suppliedPngs: number;
}

/**
 * Races a promise against a wall-clock guard.
 * @param {Promise<T>} task - Work to bound.
 * @param {number} ms - Timeout in milliseconds.
 * @param {string} code - Coded reason on expiry.
 * @returns {Promise<T>} Task result, or a coded rejection on timeout.
 */
export function withBurnTimeout<T>(
  task: Promise<T>,
  ms: number,
  code: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(code)), ms);
  });
  return Promise.race([task, guard]).then(
    (value) => {
      if (timer) clearTimeout(timer);
      return value as T;
    },
    (error: unknown) => {
      if (timer) clearTimeout(timer);
      throw error;
    }
  );
}

/**
 * Decodes a `data:image/png;base64,…` stamp URL into PNG bytes.
 * @param {string} dataUrl - Stamp data URL (hiree PNG bytes, never a PDF).
 * @returns {Uint8Array} PNG bytes.
 */
export function parseStampPngDataUrl(dataUrl: string): Uint8Array {
  const prefix = "data:image/png;base64,";
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(prefix)) {
    throw new Error(
      "STAMP_PNG_UNREADABLE: stamp image must be a data:image/png;base64 URL"
    );
  }
  const bytes = Buffer.from(dataUrl.slice(prefix.length), "base64");
  if (bytes.byteLength === 0) {
    throw new Error("STAMP_PNG_UNREADABLE: stamp image decoded to zero bytes");
  }
  if (bytes.byteLength > PDF_BURN_STAMP_PNG_MAX_BYTES) {
    throw new Error(
      `STAMP_PNG_TOO_LARGE_413: stamp image is ${bytes.byteLength} bytes — exceeds the 2MB stamp cap`
    );
  }
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const magicOk = signature.every((byte, index) => bytes[index] === byte);
  if (!magicOk) {
    throw new Error("STAMP_PNG_UNREADABLE: bytes are not a PNG document");
  }
  return new Uint8Array(bytes);
}

function countInkPoints(ink: SigningInk): number {
  let total = 0;
  for (const page of ink.pages ?? []) {
    for (const stroke of page?.strokes ?? []) {
      total += Array.isArray(stroke?.points) ? stroke.points.length : 0;
    }
  }
  return total;
}

function isDrawableStroke(stroke: SigningStroke | null | undefined): stroke is SigningStroke {
  return !!stroke && Array.isArray(stroke.points) && stroke.points.length > 0;
}

/**
 * Burns locked-envelope ink into a trusted admin-template PDF.
 * @param {BurnTemplatePdfInput} input - Template bytes + locked ink + sizes.
 * @returns {Promise<BurnTemplatePdfResult>} Burned PDF bytes + draw counts.
 */
export async function burnInkIntoTemplatePdf(
  input: BurnTemplatePdfInput
): Promise<BurnTemplatePdfResult> {
  const templateBytes = input.templateBytes;
  if (!templateBytes || templateBytes.byteLength === 0) {
    throw new Error("TEMPLATE_PDF_EMPTY: template PDF downloaded zero bytes");
  }
  if (templateBytes.byteLength > PDF_BURN_TEMPLATE_MAX_BYTES) {
    throw new Error(
      `FILE_TOO_LARGE_413: template PDF is ${(templateBytes.byteLength / 1024 / 1024).toFixed(2)}MB — exceeds the 10MB cap`
    );
  }

  let pdfDoc;
  try {
    pdfDoc = await withBurnTimeout(
      PDFDocument.load(templateBytes, { ignoreEncryption: false }),
      PDF_BURN_LOAD_TIMEOUT_MS,
      "TEMPLATE_PDF_TIMEOUT_504: template PDF parse exceeded the load guard"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("TEMPLATE_PDF_TIMEOUT_504")) throw error;
    throw new Error(
      `TEMPLATE_PDF_CORRUPT_502: template PDF could not be parsed (${message}) — rejected with reason, never filed`
    );
  }

  let ink: SigningInk;
  try {
    ink = parseInk(JSON.stringify(input.ink));
  } catch {
    throw new Error(
      "INVALID_LOCKED_INK_422: locked envelope ink is malformed — rejected with reason, never filed"
    );
  }
  const totalPoints = countInkPoints(ink);
  if (totalPoints === 0) {
    throw new Error(
      "NO_INK_TO_BURN_422: locked envelope carries no drawable mark — rejected with reason, never filed"
    );
  }
  if (totalPoints > PDF_BURN_MAX_TOTAL_POINTS) {
    throw new Error(
      `INK_TOO_LARGE_413: envelope carries ${totalPoints} ink points — exceeds the ${PDF_BURN_MAX_TOTAL_POINTS} burn cap`
    );
  }

  const merged = mergeStampsIntoInk(ink, input.stamps ?? [], input.pageSizes);
  const pageCount = pdfDoc.getPageCount();
  let drawnStrokes = 0;
  let drawnSegments = 0;
  let skippedPages = 0;

  for (const page of merged.pages) {
    const pageNum = page?.page;
    if (typeof pageNum !== "number" || pageNum < 1 || pageNum > pageCount) {
      skippedPages += 1;
      continue;
    }
    const bitmap = input.pageSizes[pageNum];
    if (
      !bitmap ||
      !(bitmap.width > 0) ||
      !(bitmap.height > 0) ||
      !Number.isFinite(bitmap.width) ||
      !Number.isFinite(bitmap.height)
    ) {
      skippedPages += 1;
      continue;
    }
    const pdfPage = pdfDoc.getPage(pageNum - 1);
    const pdfSize = pdfPage.getSize();
    for (const stroke of page.strokes ?? []) {
      if (!isDrawableStroke(stroke)) continue;
      const color = hexToPdfColor(stroke.color);
      const pdfColor = rgb(color.red, color.green, color.blue);
      const thickness = scaleStrokeWidthToPdf(stroke.width, bitmap, pdfSize);
      const mapped = stroke.points
        .map((point) => bitmapPointToPdfPoint(point.x, point.y, bitmap, pdfSize))
        .filter((point) => point !== null);
      if (mapped.length === 0) continue;
      if (mapped.length === 1) {
        const only = mapped[0];
        if (!only) continue;
        pdfPage.drawCircle({
          x: only.x,
          y: only.y,
          size: Math.max(0.5, thickness / 2),
          color: pdfColor,
          opacity: 1,
        });
        drawnStrokes += 1;
        continue;
      }
      for (let index = 1; index < mapped.length; index += 1) {
        const from = mapped[index - 1];
        const to = mapped[index];
        if (!from || !to) continue;
        pdfPage.drawLine({
          start: { x: from.x, y: from.y },
          end: { x: to.x, y: to.y },
          thickness,
          color: pdfColor,
          opacity: 1,
          lineCap: LineCapStyle.Round,
        });
        drawnSegments += 1;
      }
      drawnStrokes += 1;
    }
  }

  // Signature PNGs are redundant with the stamp vectors already burned above:
  // a corrupt PNG skips (counted) while the vector signature still files.
  const suppliedPngs = Array.isArray(input.stampPngs) ? input.stampPngs.length : 0;
  let embeddedPngs = 0;
  const stamps = Array.isArray(input.stamps) ? input.stamps : [];
  for (const entry of input.stampPngs ?? []) {
    try {
      const stamp = stamps.find((candidate) => candidate?.id === entry?.stampId);
      if (!stamp || typeof stamp.page !== "number") continue;
      if (stamp.page < 1 || stamp.page > pageCount) continue;
      const pdfPage = pdfDoc.getPage(stamp.page - 1);
      const rect = stampAnchorToPdfRect(stamp.x, stamp.y, pdfPage.getSize());
      if (!rect) continue;
      const pngBytes = parseStampPngDataUrl(entry.pngDataUrl);
      const image = await pdfDoc.embedPng(pngBytes);
      pdfPage.drawImage(image, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
      embeddedPngs += 1;
    } catch (error) {
      console.error("[onboarding-pdf-burn] stamp PNG skipped:", error);
    }
  }

  let bytes: Uint8Array;
  try {
    bytes = await withBurnTimeout(
      pdfDoc.save(),
      PDF_BURN_SAVE_TIMEOUT_MS,
      "BURN_SAVE_TIMEOUT_504: burned PDF save exceeded the save guard"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("BURN_SAVE_TIMEOUT_504")) throw error;
    throw new Error(`BURN_SAVE_FAILED_502: burned PDF could not be saved (${message})`);
  }
  if (bytes.byteLength > PDF_BURN_OUTPUT_MAX_BYTES) {
    throw new Error(
      `FILE_TOO_LARGE_413: burned PDF is ${(bytes.byteLength / 1024 / 1024).toFixed(2)}MB — exceeds the 10MB 201 ceiling; split or re-file, never downscaled`
    );
  }
  if (drawnStrokes === 0) {
    throw new Error(
      `NOTHING_BURNED_422: no ink mapped onto the template (${skippedPages} page(s) skipped) — rejected with reason, never filed`
    );
  }

  return {
    bytes,
    pageCount,
    drawnStrokes,
    drawnSegments,
    skippedPages,
    embeddedPngs,
    suppliedPngs,
  };
}
