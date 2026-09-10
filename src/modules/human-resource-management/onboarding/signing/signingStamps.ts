import { z } from "zod";

import type { PaperworkPageSize } from "../paperwork/paperworkValidity";
import type { SigningInk, SigningStroke } from "./signingStrokes";

// One signature stamp placed on a page: top-left anchor in page FRACTIONS
// (0..1, resolution-independent — same space as PaperworkZone rects) plus
// the captured pad strokes in pad-bitmap px. `stampToStrokes` translates
// them into page-bitmap space so the validity predicate honors stamped ink
// exactly like drawn ink.
export const SigningStampSchema = z
  .object({
    id: z.string().min(1).max(64),
    page: z.number().int().positive(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    strokes: z
      .array(
        z
          .object({
            points: z.array(
              z.object({ x: z.number(), y: z.number() }).strict()
            ),
            width: z.number().positive(),
            color: z.string(),
          })
          .strict()
      )
      .max(500),
  })
  .strict();

export type SigningStamp = z.infer<typeof SigningStampSchema>;

// signingStamps.ts — stamp→ink merge shared by the signing surface (client
// validity preview) and the server burn core. Import-safe:
// no DOM, no canvas — pure coordinate math so both sides compute the SAME
// merged ink from the same payload.
//
// A stamp anchors at page fractions {x, y} (top-left of the captured pad
// bitmap); each pad-space point translates by (x * pageW, y * pageH) into
// page-bitmap space. The merged ink is what `isPaperworkValid` sees, so
// stamped signatures honor required zones exactly like drawn ink.

/**
 * Translates captured pad strokes onto a page at the stamp anchor.
 * @param {SigningStamp} stamp - Stamp with fraction anchor + pad strokes.
 * @param {PaperworkPageSize} pageSize - Renderer-owned bitmap size.
 * @returns {SigningStroke[]} Page-bitmap-space strokes.
 */
export function stampToStrokes(
  stamp: SigningStamp,
  pageSize: PaperworkPageSize
): SigningStroke[] {
  if (!stamp || !Array.isArray(stamp.strokes)) return [];
  if (
    !pageSize ||
    !(pageSize.width > 0) ||
    !(pageSize.height > 0) ||
    !Number.isFinite(stamp.x) ||
    !Number.isFinite(stamp.y)
  ) {
    return [];
  }
  const dx = stamp.x * pageSize.width;
  const dy = stamp.y * pageSize.height;
  return stamp.strokes.map((stroke) => ({
    points: Array.isArray(stroke.points)
      ? stroke.points.map((point) => ({ x: point.x + dx, y: point.y + dy }))
      : [],
    width: stroke.width,
    color: stroke.color,
  }));
}

/**
 * Merges placed stamps into a copy of the freehand ink (never mutates).
 * @param {SigningInk} ink - Freehand ink document.
 * @param {SigningStamp[]} stamps - Placed stamps (png preview excluded).
 * @param {Record<number, PaperworkPageSize>} pageSizes - Bitmap size per
 * 1-based page number.
 * @returns {SigningInk} New ink document with stamp strokes appended per page.
 */
export function mergeStampsIntoInk(
  ink: SigningInk,
  stamps: SigningStamp[] | null | undefined,
  pageSizes: Record<number, PaperworkPageSize>
): SigningInk {
  const pages = Array.isArray(ink?.pages)
    ? ink.pages.map((page) => ({
        page: page.page,
        strokes: Array.isArray(page?.strokes)
          ? page.strokes.map((stroke) => ({
              points: stroke.points.map((point) => ({ x: point.x, y: point.y })),
              width: stroke.width,
              color: stroke.color,
            }))
          : [],
      }))
    : [];
  if (!Array.isArray(stamps)) return { pages };
  for (const stamp of stamps) {
    if (!stamp || typeof stamp.page !== "number") continue;
    const size = pageSizes[stamp.page];
    if (!size) continue;
    const translated = stampToStrokes(stamp, size);
    if (translated.length === 0) continue;
    const target = pages.find((page) => page.page === stamp.page);
    if (target) {
      target.strokes.push(...translated);
    } else {
      pages.push({ page: stamp.page, strokes: translated });
    }
  }
  return { pages };
}
