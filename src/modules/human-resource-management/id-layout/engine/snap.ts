import { ID_CARD } from "../types/id-layout.schema";
import type { IdNode } from "../types/id-layout.schema";

export const ID_SNAP_TOLERANCE = 8;

export interface IdSnapRect {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

export interface IdSnapResult {
    readonly dx: number;
    readonly dy: number;
    readonly xLines: readonly number[];
    readonly yLines: readonly number[];
}

export interface IdSnapOverlay {
    readonly xLines: readonly number[];
    readonly yLines: readonly number[];
}

export interface IdSnapOutcome extends IdSnapResult {
    readonly overlay: IdSnapOverlay | null;
}

function uniqueSorted(values: readonly number[]): number[] {
    return Array.from(new Set(values)).sort((a, b) => a - b);
}

export function matchIdSnap(
    dragged: readonly IdSnapRect[],
    statics: readonly IdSnapRect[],
    rawDx: number,
    rawDy: number,
    cardWidth: number = ID_CARD.width,
    cardHeight: number = ID_CARD.height,
    tolerance: number = ID_SNAP_TOLERANCE,
): IdSnapResult {
    const staticX = [0, cardWidth / 2, cardWidth];
    const staticY = [0, cardHeight / 2, cardHeight];
    for (const rect of statics) {
        staticX.push(rect.x, rect.x + rect.w / 2, rect.x + rect.w);
        staticY.push(rect.y, rect.y + rect.h / 2, rect.y + rect.h);
    }
    let adjustX = 0;
    let foundX = false;
    for (const rect of dragged) {
        const edges = [rect.x + rawDx, rect.x + rawDx + rect.w / 2, rect.x + rawDx + rect.w];
        for (const edge of edges) {
            for (const line of staticX) {
                const delta = line - edge;
                if (Math.abs(delta) <= tolerance && (!foundX || Math.abs(delta) < Math.abs(adjustX))) {
                    adjustX = delta;
                    foundX = true;
                }
            }
        }
    }
    let adjustY = 0;
    let foundY = false;
    for (const rect of dragged) {
        const edges = [rect.y + rawDy, rect.y + rawDy + rect.h / 2, rect.y + rawDy + rect.h];
        for (const edge of edges) {
            for (const line of staticY) {
                const delta = line - edge;
                if (Math.abs(delta) <= tolerance && (!foundY || Math.abs(delta) < Math.abs(adjustY))) {
                    adjustY = delta;
                    foundY = true;
                }
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
                for (const line of staticY) {
                    if (Math.abs(line - edge) <= 1) yLines.push(line);
                }
            }
        }
    }
    return { dx, dy, xLines: uniqueSorted(xLines), yLines: uniqueSorted(yLines) };
}

export function snapIdDrag(
    nodes: Readonly<Record<string, IdNode>>,
    pageRootIds: readonly string[],
    draggedIds: readonly string[],
    primaryId: string,
    dx: number,
    dy: number,
    snapEnabled: boolean,
): IdSnapOutcome {
    const fallback: IdSnapOutcome = { dx, dy, xLines: [], yLines: [], overlay: null };
    const primary = nodes[primaryId];
    if (!primary || !snapEnabled) return fallback;
    const dragged = new Set<string>(draggedIds);
    if (!dragged.has(primaryId)) return fallback;
    const inPage = new Set<string>(pageRootIds);
    if (!inPage.has(primaryId)) return fallback;
    const siblings: IdSnapRect[] = [];
    for (const id of pageRootIds) {
        if (dragged.has(id)) continue;
        const node = nodes[id];
        if (node) siblings.push({ x: node.x, y: node.y, w: node.w, h: node.h });
    }
    const draggedRects: IdSnapRect[] = [];
    for (const id of draggedIds) {
        const node = nodes[id];
        if (node && inPage.has(id)) draggedRects.push({ x: node.x, y: node.y, w: node.w, h: node.h });
    }
    if (draggedRects.length === 0) return fallback;
    const snapped = matchIdSnap(draggedRects, siblings, dx, dy);
    if (snapped.xLines.length === 0 && snapped.yLines.length === 0) {
        return { dx: snapped.dx, dy: snapped.dy, xLines: snapped.xLines, yLines: snapped.yLines, overlay: null };
    }
    return {
        dx: snapped.dx,
        dy: snapped.dy,
        xLines: snapped.xLines,
        yLines: snapped.yLines,
        overlay: { xLines: snapped.xLines, yLines: snapped.yLines },
    };
}
