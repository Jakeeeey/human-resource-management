import type { CanvasBadge } from "../components/canvas-badges";
import type { CanvasDoc, CanvasNode } from "../types/canvas-doc.schema";
import {
    bucketRows,
    byDisplayOrder,
    rowTop,
    ROW_Y_TOLERANCE,
    verticalGap,
} from "./export-layout";

export const MOBILE_CONTENT_WIDTH = 375;
export const DESKTOP_CONTENT_WIDTH = 600;

export interface MobileNodeGeometry {
    readonly id: string;
    readonly type: CanvasNode["type"];
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly fullWidth: boolean;
    readonly rotated: boolean;
}

export interface MobileViewModel {
    readonly width: number;
    readonly order: readonly string[];
    readonly rows: ReadonlyArray<readonly string[]>;
    readonly geometries: Readonly<Record<string, MobileNodeGeometry>>;
    readonly totalHeight: number;
}

export type MobileDocInput = Pick<CanvasDoc, "nodes" | "rootIds">;

function stageRoots(doc: MobileDocInput): CanvasNode[] {
    const roots: CanvasNode[] = [];
    for (const id of doc.rootIds) {
        const node = doc.nodes[id];
        if (node) roots.push(node);
    }
    return roots.sort(byDisplayOrder);
}

function boxChildren(doc: MobileDocInput, boxId: string): CanvasNode[] {
    return Object.values(doc.nodes)
        .filter((node) => node.parentId === boxId)
        .sort(byDisplayOrder);
}

export function buildMobileViewModel(doc: MobileDocInput): MobileViewModel {
    const rows = bucketRows(stageRoots(doc), ROW_Y_TOLERANCE);
    const geometries: Record<string, MobileNodeGeometry> = {};
    const order: string[] = [];
    const rowIds: string[][] = [];
    let cursor = rows.length > 0 ? Math.max(0, rowTop(rows[0])) : 0;
    rows.forEach((row, rowIndex) => {
        const prev = rowIndex > 0 ? rows[rowIndex - 1] : undefined;
        if (prev) cursor += verticalGap(prev, row);
        const ids: string[] = [];
        for (const node of row) {
            let nodeH = node.h;
            if (node.type === "box") {
                let childCursor = 0;
                for (const child of boxChildren(doc, node.id)) {
                    geometries[child.id] = {
                        id: child.id,
                        type: child.type,
                        x: 0,
                        y: childCursor,
                        w: MOBILE_CONTENT_WIDTH,
                        h: child.h,
                        fullWidth: true,
                        rotated: child.rotation !== 0,
                    };
                    childCursor += child.h;
                }
                nodeH = Math.max(node.h, childCursor);
            }
            geometries[node.id] = {
                id: node.id,
                type: node.type,
                x: 0,
                y: cursor,
                w: MOBILE_CONTENT_WIDTH,
                h: nodeH,
                fullWidth: true,
                rotated: node.rotation !== 0,
            };
            ids.push(node.id);
            order.push(node.id);
            cursor += nodeH;
        }
        rowIds.push(ids);
    });
    return { width: MOBILE_CONTENT_WIDTH, order, rows: rowIds, geometries, totalHeight: cursor };
}

export function isClippedForDevice(
    geom: Pick<MobileNodeGeometry, "x" | "w">,
    deviceWidth: number,
): boolean {
    return geom.x < 0 || geom.x + geom.w > deviceWidth;
}

export function mobileClippedIds(
    model: MobileViewModel,
    deviceWidth: number = MOBILE_CONTENT_WIDTH,
): string[] {
    return model.order.filter((id) => {
        const geom = model.geometries[id];
        return geom ? isClippedForDevice(geom, deviceWidth) : false;
    });
}

function badgeFor(geom: MobileNodeGeometry, deviceWidth: number): CanvasBadge[] {
    const list: CanvasBadge[] = [];
    if (geom.rotated) list.push("ROTATED");
    if (isClippedForDevice(geom, deviceWidth)) list.push("CLIPPED");
    return list;
}

export function mobileNodeBadges(model: MobileViewModel): Record<string, CanvasBadge[]> {
    const badges: Record<string, CanvasBadge[]> = {};
    for (const geom of Object.values(model.geometries)) {
        badges[geom.id] = badgeFor(geom, model.width);
    }
    return badges;
}
