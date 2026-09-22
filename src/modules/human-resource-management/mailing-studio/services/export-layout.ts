// T9 export layout — PURE helpers (no mjml, no I/O) so bucket/overlap/clamp stay unit-testable.
import {
    CANVAS_WIDTH,
    resolveStyleValue,
    type CanvasDoc,
    type CanvasNode,
} from "../types/canvas-doc.schema";

/** y-center bucketing tolerance in px (±8 per plan). */
export const ROW_Y_TOLERANCE = 8;

function centerY(node: CanvasNode): number {
    return node.y + node.h / 2;
}

/** Reading order: y, then x, then id (stable across engines). */
export function byDisplayOrder(a: CanvasNode, b: CanvasNode): number {
    return a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);
}

/** Stage-root nodes in display order. */
export function rootsOf(doc: CanvasDoc): CanvasNode[] {
    const roots: CanvasNode[] = [];
    for (const id of doc.rootIds) {
        const node = doc.nodes[id];
        if (node) roots.push(node);
    }
    return roots.sort(byDisplayOrder);
}

/** Children of a box in display order. */
export function childrenOf(doc: CanvasDoc, boxId: string): CanvasNode[] {
    return Object.values(doc.nodes)
        .filter((node) => node.parentId === boxId)
        .sort(byDisplayOrder);
}

/**
 * (a) Display order: roots sorted into reading order, with each box's children
 * flattened directly after it (parent order).
 */
export function flattenDisplayOrder(doc: CanvasDoc): CanvasNode[] {
    const out: CanvasNode[] = [];
    for (const root of rootsOf(doc)) {
        out.push(root);
        if (root.type === "box") out.push(...childrenOf(doc, root.id));
    }
    return out;
}

/**
 * (b)+(c) Bucket nodes into rows by y-center (± tolerance vs the row anchor),
 * then sort each row by x.
 */
export function bucketRows(nodes: readonly CanvasNode[], tolerance = ROW_Y_TOLERANCE): CanvasNode[][] {
    const byCenter = [...nodes].sort(
        (a, b) => centerY(a) - centerY(b) || a.x - b.x || a.id.localeCompare(b.id),
    );
    const rows: CanvasNode[][] = [];
    let anchor: number | null = null;
    for (const node of byCenter) {
        const center = centerY(node);
        if (anchor === null || Math.abs(center - anchor) > tolerance) {
            rows.push([node]);
            anchor = center;
        } else {
            rows[rows.length - 1].push(node);
        }
    }
    for (const row of rows) row.sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
    return rows;
}

function xIntervalsIntersect(a: CanvasNode, b: CanvasNode): boolean {
    return a.x < b.x + b.w && b.x < a.x + a.w;
}

function yExtentsIntersect(a: CanvasNode, b: CanvasNode): boolean {
    return a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * (e) Overlap detection after y-bucketing: same-row pairs intersect on
 * x-intervals; cross-row pairs intersect on vertical extents. Returns the ids
 * to flag, in first-seen order.
 */
export function findOverlaps(rows: readonly (readonly CanvasNode[])[]): string[] {
    const flat: Array<{ node: CanvasNode; row: number }> = [];
    rows.forEach((row, rowIndex) => {
        for (const node of row) flat.push({ node, row: rowIndex });
    });
    const flagged: string[] = [];
    const seen = new Set<string>();
    const mark = (id: string): void => {
        if (!seen.has(id)) {
            seen.add(id);
            flagged.push(id);
        }
    };
    for (let i = 0; i < flat.length; i += 1) {
        for (let j = i + 1; j < flat.length; j += 1) {
            const a = flat[i];
            const b = flat[j];
            const hit = a.row === b.row
                ? xIntervalsIntersect(a.node, b.node)
                : yExtentsIntersect(a.node, b.node);
            if (hit) {
                mark(a.node.id);
                mark(b.node.id);
            }
        }
    }
    return flagged;
}

/** (e) Stage clip: node starts left of 0 or ends past the 600px stage. */
export function isClipped(node: CanvasNode): boolean {
    return node.x < 0 || node.x + node.w > CANVAS_WIDTH;
}

/** Width remaining after clamping the node's bbox to [0, 600]. */
export function clampedWidth(node: CanvasNode): number {
    const left = Math.max(0, node.x);
    const right = Math.min(CANVAS_WIDTH, node.x + node.w);
    return Math.max(0, right - left);
}

/** mj-column width = round(clampedW / 600 * 100)%, floored at 20%. */
export function columnWidthPercent(node: CanvasNode): string {
    const percent = Math.round((clampedWidth(node) / CANVAS_WIDTH) * 100);
    return `${Math.max(20, percent)}%`;
}

/** Column span from the row cursor to the node right edge, as an mj-column
width %. Columns tile the section, so a column covers prevEnd..x+w and its
padding-left (= x − prevEnd) eats inside that span — leaving exactly w for
content. Using w alone as the width double-counts the offset and starves
content (button text wrapping letter-by-letter). prevEnd mirrors the
leadingGaps traversal (0, then each prior right edge). */
export function columnSpanPercent(node: CanvasNode, prevEnd: number): string {
    const right = Math.min(CANVAS_WIDTH, node.x + node.w);
    const span = Math.max(0, right - prevEnd);
    const percent = Math.round((span / CANVAS_WIDTH) * 100);
    return `${Math.max(20, percent)}%`;
}

/** Top edge (min y) of a row — the canvas top offset for the first row. */
export function rowTop(row: readonly CanvasNode[]): number {
    return Math.min(...row.map((node) => node.y));
}

/** Bottom edge (max y + h) of a row. */
export function rowBottom(row: readonly CanvasNode[]): number {
    return Math.max(...row.map((node) => node.y + node.h));
}

/**
 * Exact canvas gap between two stacked rows (later top − earlier bottom),
 * clamped ≥ 0. Overlapping rows yield 0 — the overlap itself still warns via
 * findOverlaps; the gap helper only sizes section padding.
 */
export function verticalGap(prevRow: readonly CanvasNode[], row: readonly CanvasNode[]): number {
    return Math.max(0, rowTop(row) - rowBottom(prevRow));
}

/**
 * Per-node leading x-gap within an x-sorted row: canvas spacing before this
 * node back to the previous node's right edge (first entry measures from
 * stage left, x = 0), each clamped ≥ 0. The exporter carries these as
 * mj-column padding-left so in-row offsets survive export.
 */
export function leadingGaps(row: readonly CanvasNode[]): number[] {
    const gaps: number[] = [];
    let prevEnd = 0;
    for (const node of row) {
        gaps.push(Math.max(0, node.x - prevEnd));
        prevEnd = Math.max(prevEnd, node.x + node.w);
    }
    return gaps;
}

/** Email text line-height factor used to size buttons from canvas geometry. */
const BUTTON_LINE_HEIGHT = 1.4;

/** Average glyph width as a fraction of font-size (latin label estimate). */
const BUTTON_GLYPH_WIDTH = 0.55;

/**
 * Size-derived mj-button padding so the rendered button fills its canvas w/h.
 * mj-button has no width/height attrs — padding is the only box-model lever:
 * vertical = (h − text line height) / 2, horizontal = (w − estimated label
 * width) / 2, each clamped ≥ 0 and rounded. fontSize resolves through the
 * shared fidelity contract (props → theme 14); the label is props.text with
 * the legacy props.label fallback (same pick as the exporter).
 */
export function buttonSizePadding(node: CanvasNode): string {
    const fontSize = resolveStyleValue(node.type, node.props, "fontSize");
    const fs = typeof fontSize === "number" ? fontSize : 14;
    const rawLabel = node.props["text"] ?? node.props["label"];
    const label = typeof rawLabel === "string" ? rawLabel : "";
    const vertical = Math.max(0, Math.round((node.h - fs * BUTTON_LINE_HEIGHT) / 2));
    // Horizontal centers the label in w, but never below (w/2 − 1): the column
    // content box is exactly w, so padding past half leaves no room for text
    // and MJML wraps it letter-by-letter. Tiny buttons degrade to full-bleed
    // text instead of wrapping.
    const centered = Math.round((node.w - label.length * fs * BUTTON_GLYPH_WIDTH) / 2);
    const horizontal = Math.max(0, Math.min(centered, Math.floor(node.w / 2) - 1));
    return `${vertical}px ${horizontal}px`;
}
