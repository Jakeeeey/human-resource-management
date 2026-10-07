import type { PaperworkZone } from "./types/paperwork-template.schema";
import type { SigningInk } from "../signing/signingStrokes";

// paperworkValidity.ts — THE single validity definition for paperwork signing
// (Todo 6). Todos 7-8 import this file; never redefine the rule elsewhere.
//
// Quoted predicate (no invented semantics):
// - Template WITH required zones → valid iff EVERY required zone is inked.
// - Template with ZERO required zones (optional-only or no zones at all) →
//   valid iff there is ≥1 ink mark ANYWHERE in the envelope.
// - Anything else (required zone uninked, or zero-required with empty ink) →
//   invalid with a reason string the signing surface shows when Finish is
//   blocked.
//
// Geometry: zones live in template FRACTIONS (0..1, resolution-independent)
// while ink points live in canvas-bitmap px (see `signingStrokes.ts`). The
// caller (Todo 7 surface, which owns the rendered DOM) supplies the bitmap
// size per page; a point maps to fractions by dividing by that size. A zone
// counts as inked when ≥1 ink point on the SAME page falls inside its rect
// (edges inclusive). Unit vectors can pass page sizes of {width:1,height:1}
// so points read as fractions directly — no DOM, no canvas, import-safe.

export interface PaperworkPageSize {
  width: number;
  height: number;
}

export interface PaperworkValidityVerdict {
  valid: boolean;
  missingRequiredIds: string[];
  reason: string | null;
}

function isDrawablePoint(point: unknown): point is { x: number; y: number } {
  if (typeof point !== "object" || point === null) return false;
  const candidate = point as Record<string, unknown>;
  return (
    typeof candidate["x"] === "number" &&
    Number.isFinite(candidate["x"]) &&
    typeof candidate["y"] === "number" &&
    Number.isFinite(candidate["y"])
  );
}

/**
 * True when the envelope carries any drawable mark on any page (tap-dots
 * count — a single-point stroke is ink per the Todo 3 tap-dot rule).
 * @param {SigningInk | null | undefined} ink - Envelope stroke model.
 * @returns {boolean} True when ≥1 stroke holds ≥1 finite point.
 */
export function hasAnyInkMark(ink: SigningInk | null | undefined): boolean {
  if (!ink || !Array.isArray(ink.pages)) return false;
  return ink.pages.some(
    (page) =>
      Array.isArray(page?.strokes) &&
      page.strokes.some(
        (stroke) =>
          Array.isArray(stroke?.points) &&
          stroke.points.some(isDrawablePoint)
      )
  );
}

/**
 * Zone ids that carry ≥1 ink point inside their fraction rect on the same
 * page. Pages with an unknown or degenerate bitmap size contribute no hits
 * (their strokes still count for the zero-required any-mark rule).
 * @param {PaperworkZone[]} zones - Template zones (fraction rects).
 * @param {SigningInk | null | undefined} ink - Envelope stroke model.
 * @param {Record<number, PaperworkPageSize>} pageSizes - Bitmap size per
 * 1-based page number.
 * @returns {string[]} Inked zone ids (deduplicated, zone order preserved).
 */
export function getInkedZoneIds(
  zones: PaperworkZone[],
  ink: SigningInk | null | undefined,
  pageSizes: Record<number, PaperworkPageSize>
): string[] {
  if (!Array.isArray(zones) || zones.length === 0) return [];
  if (!ink || !Array.isArray(ink.pages)) return [];
  const hit = new Set<string>();
  for (const page of ink.pages) {
    if (!page || !Array.isArray(page.strokes)) continue;
    const size = pageSizes[page.page];
    if (
      !size ||
      typeof size.width !== "number" ||
      typeof size.height !== "number" ||
      !(size.width > 0) ||
      !(size.height > 0)
    ) {
      continue;
    }
    for (const zone of zones) {
      if (zone.page !== page.page || hit.has(zone.id)) continue;
      const inside = page.strokes.some(
        (stroke) =>
          Array.isArray(stroke?.points) &&
          stroke.points.some(
            (point) =>
              isDrawablePoint(point) &&
              point.x / size.width >= zone.rect.x &&
              point.x / size.width <= zone.rect.x + zone.rect.w &&
              point.y / size.height >= zone.rect.y &&
              point.y / size.height <= zone.rect.y + zone.rect.h
          )
      );
      if (inside) hit.add(zone.id);
    }
  }
  return zones
    .map((zone) => zone.id)
    .filter((id, index, all) => hit.has(id) && all.indexOf(id) === index);
}

/**
 * THE validity predicate for paperwork signing (single definition — Todos
 * 7-8 import this, never redefine it).
 * @param {PaperworkZone[]} zones - Template zones (fraction rects).
 * @param {SigningInk | null | undefined} ink - Envelope stroke model.
 * @param {Record<number, PaperworkPageSize>} pageSizes - Bitmap size per
 * 1-based page number (Todo 7 supplies the rendered sizes).
 * @returns {PaperworkValidityVerdict} Verdict + missing required ids + reason.
 */
export function isPaperworkValid(
  zones: PaperworkZone[],
  ink: SigningInk | null | undefined,
  pageSizes: Record<number, PaperworkPageSize>
): PaperworkValidityVerdict {
  const list = Array.isArray(zones) ? zones : [];
  const required = list.filter((zone) => zone.required === true);
  if (required.length > 0) {
    const inked = new Set(getInkedZoneIds(list, ink, pageSizes));
    const missing = required
      .map((zone) => zone.id)
      .filter((id) => !inked.has(id));
    if (missing.length === 0) {
      return { valid: true, missingRequiredIds: [], reason: null };
    }
    return {
      valid: false,
      missingRequiredIds: missing,
      reason: `Required zone${missing.length === 1 ? "" : "s"} missing ink: ${missing.join(", ")}`,
    };
  }
  if (hasAnyInkMark(ink)) {
    return { valid: true, missingRequiredIds: [], reason: null };
  }
  return {
    valid: false,
    missingRequiredIds: [],
    reason: "No ink marks found",
  };
}
