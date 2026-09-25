import type { CanvasNode } from "../types/canvas-doc.schema";

// Pure badge predicates for the live canvas (T8). Mirrors CANVAS_WIDTH from
// types/canvas-doc.schema.ts as a local literal so this module stays free of
// runtime imports (zod) for standalone pure asserts.
export const STAGE_WIDTH = 600;

export type CanvasBadge = "ROTATED" | "OVERLAP" | "CLIPPED";

/** ROTATED — node has a non-zero rotation at rest. */
export function isRotated(node: CanvasNode): boolean {
    return node.rotation !== 0;
}

/** CLIPPED — node bbox sticks out of the live stage width horizontally. */
export function isClipped(node: CanvasNode, stageWidth: number = STAGE_WIDTH): boolean {
    return node.x + node.w > stageWidth || node.x < 0;
}

/** Strict bbox intersection (edge-touching does not count). */
export function bboxIntersects(a: CanvasNode, b: CanvasNode): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Badge list for one node against all nodes in the doc (self excluded).
 * Stable order: ROTATED, OVERLAP, CLIPPED.
 */
export function nodeBadges(
    node: CanvasNode,
    peers: readonly CanvasNode[],
    stageWidth: number = STAGE_WIDTH,
): CanvasBadge[] {
    const badges: CanvasBadge[] = [];
    if (isRotated(node)) badges.push("ROTATED");
    if (peers.some((peer) => peer.id !== node.id && bboxIntersects(node, peer))) {
        badges.push("OVERLAP");
    }
    if (isClipped(node, stageWidth)) badges.push("CLIPPED");
    return badges;
}
