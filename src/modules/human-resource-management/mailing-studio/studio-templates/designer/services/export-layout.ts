// T9 export layout — PURE helpers (no mjml, no I/O) so bucket/overlap/clamp stay unit-testable.
import {
    CANVAS_WIDTH,
    resolveStyleValue,
    type CanvasDoc,
    type CanvasNode,
} from "../types/canvas-doc.schema";

/**
 * y-center bucketing tolerance in px. ±8 was impossible to hit by hand, so
 * side-by-side blocks silently collapsed into solo rows on export. ±24 is
 * hand-reachable yet still well below a real stacked-row gap, and the canvas
 * snap uses this same constant so WYSIWYG holds.
 */
export const ROW_Y_TOLERANCE = 24;

/**
 * Snap tolerance for the full edge/center guide set (px). Deliberately
 * tighter than the row bucket: guides feel magnetic without sticking, while
 * the y-center row pull still uses ROW_Y_TOLERANCE so canvas rows match
 * export bucketing.
 */
export const SNAP_TOLERANCE = 8;

export interface SnapRect {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

export interface SnapLines {
    readonly dx: number;
    readonly dy: number;
    readonly xLines: readonly number[];
    readonly yLines: readonly number[];
}

function uniqueSorted(values: readonly number[]): number[] {
    return Array.from(new Set(values)).sort((a, b) => a - b);
}

/**
 * Full standard snap set for a drag offset. X matches left edge, x-center,
 * right edge against sibling edges plus stage lines (default 0 / center /
 * full width); Y matches top edge, y-center, bottom edge against sibling
 * edges plus stage top (default y = 0), with y-center-vs-sibling-center
 * additionally eligible at ROW_Y_TOLERANCE so the row pull shares export
 * bucketing. Returns the adjusted offset plus the active guide lines.
 */
export function matchSnap(
    dragged: readonly SnapRect[],
    statics: readonly SnapRect[],
    rawDx: number,
    rawDy: number,
    stageX: readonly number[] = [0, CANVAS_WIDTH / 2, CANVAS_WIDTH],
    stageY: readonly number[] = [0],
    tolerance = SNAP_TOLERANCE,
): SnapLines {
    const staticX = [...stageX];
    const staticY = [...stageY];
    const staticCentersY: number[] = [];
    for (const rect of statics) {
        staticX.push(rect.x, rect.x + rect.w / 2, rect.x + rect.w);
        staticY.push(rect.y, rect.y + rect.h);
        staticCentersY.push(rect.y + rect.h / 2);
    }
    let adjustX = 0;
    let foundX = false;
    for (const rect of dragged) {
        const edges = [rect.x + rawDx, rect.x + rawDx + rect.w / 2, rect.x + rawDx + rect.w];
        for (const edge of edges) {
            for (const line of staticX) {
                const delta = line - edge;
                if (
                    Math.abs(delta) <= tolerance &&
                    (!foundX || Math.abs(delta) < Math.abs(adjustX))
                ) {
                    adjustX = delta;
                    foundX = true;
                }
            }
        }
    }
    let adjustY = 0;
    let foundY = false;
    for (const rect of dragged) {
        const edges: Array<{ value: number; limit: number }> = [
            { value: rect.y + rawDy, limit: tolerance },
            { value: rect.y + rawDy + rect.h / 2, limit: tolerance },
            { value: rect.y + rawDy + rect.h, limit: tolerance },
        ];
        for (const edge of edges) {
            for (const line of staticY) {
                const delta = line - edge.value;
                if (
                    Math.abs(delta) <= edge.limit &&
                    (!foundY || Math.abs(delta) < Math.abs(adjustY))
                ) {
                    adjustY = delta;
                    foundY = true;
                }
            }
        }
        const center = rect.y + rawDy + rect.h / 2;
        for (const siblingCenter of staticCentersY) {
            const delta = siblingCenter - center;
            if (
                Math.abs(delta) <= ROW_Y_TOLERANCE &&
                (!foundY || Math.abs(delta) < Math.abs(adjustY))
            ) {
                adjustY = delta;
                foundY = true;
            }
        }
    }
    const dx = rawDx + Math.round(adjustX);
    const dy = rawDy + Math.round(adjustY);
    const xLines: number[] = [];
    if (foundX) {
        for (const rect of dragged) {
            const edges = [rect.x + dx, rect.x + dx + rect.w / 2, rect.x + dx + rect.w];
            for (const edge of edges) {
                for (const line of staticX) {
                    if (Math.abs(line - edge) <= 1) xLines.push(line);
                }
            }
        }
    }
    const yLines: number[] = [];
    if (foundY) {
        for (const rect of dragged) {
            const edges = [rect.y + dy, rect.y + dy + rect.h / 2, rect.y + dy + rect.h];
            for (const edge of edges) {
                for (const line of [...staticY, ...staticCentersY]) {
                    if (Math.abs(line - edge) <= 1) yLines.push(line);
                }
            }
        }
    }
    return { dx, dy, xLines: uniqueSorted(xLines), yLines: uniqueSorted(yLines) };
}

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
