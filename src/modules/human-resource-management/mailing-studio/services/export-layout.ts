// T9 export layout — PURE helpers (no mjml, no I/O) so bucket/overlap/clamp stay unit-testable.
import { CANVAS_WIDTH, type CanvasDoc, type CanvasNode } from "../types/canvas-doc.schema";

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
