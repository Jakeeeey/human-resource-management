"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Moveable from "react-moveable";
import Selecto from "react-selecto";

import { useCanvasDoc } from "../hooks/useCanvasDoc";
import { bucketRows, matchSnap, ROW_Y_TOLERANCE } from "../services/export-layout";
import type { CanvasNode } from "../types/canvas-doc.schema";
import { SnapGuidesOverlay, type SnapMateBox } from "./CanvasNodeView";

interface CanvasMoveableProps {
    readonly stageEl: HTMLDivElement | null;
    readonly targetId: string | null;
    readonly width: number;
}

interface ResizeCommit {
    readonly width?: number;
    readonly height?: number;
    readonly drag?: { readonly left?: number; readonly top?: number };
}

interface RowSnapOverlay {
    readonly xLines: readonly number[];
    readonly yLines: readonly number[];
    readonly mates: readonly SnapMateBox[];
    readonly rowLabel: string | null;
}

interface RowSnapResult {
    readonly dx: number;
    readonly dy: number;
    readonly overlay: RowSnapOverlay | null;
}

// Full snap set (matchSnap: X left/center/right + Y top/center/bottom vs
// siblings and stage bounds, y-center row pull at ROW_Y_TOLERANCE) with the
// live export row (same bucketRows) driving the mate highlight, so canvas
// grouping is exactly what export emits.
function applyRowSnap(
    nodes: Readonly<Record<string, CanvasNode>>,
    draggedIds: readonly string[],
    primaryId: string,
    dx: number,
    dy: number,
): RowSnapResult {
    const primary = nodes[primaryId];
    if (!primary) return { dx, dy, overlay: null };
    const dragged = new Set(draggedIds);
    const siblings = Object.values(nodes).filter(
        (node) => node.parentId === primary.parentId && !dragged.has(node.id),
    );
    const draggedRects = draggedIds.flatMap((id) => {
        const node = nodes[id];
        return node ? [{ x: node.x, y: node.y, w: node.w, h: node.h }] : [];
    });
    const snapped = matchSnap(draggedRects, siblings, dx, dy);
    const placed: CanvasNode[] = [
        ...siblings,
        ...draggedIds.flatMap((id) => {
            const node = nodes[id];
            return node
                ? [{ ...node, x: node.x + snapped.dx, y: node.y + snapped.dy }]
                : [];
        }),
    ];
    const row = bucketRows(placed, ROW_Y_TOLERANCE).find((members) =>
        members.some((member) => member.id === primaryId),
    );
    const mates: SnapMateBox[] =
        row === undefined
            ? []
            : row
                  .filter((member) => !dragged.has(member.id))
                  .map((member) => ({
                      id: member.id,
                      x: member.x,
                      y: member.y,
                      w: member.w,
                      h: member.h,
                  }));
    if (
        snapped.xLines.length === 0 &&
        snapped.yLines.length === 0 &&
        mates.length === 0
    ) {
        return { dx: snapped.dx, dy: snapped.dy, overlay: null };
    }
    return {
        dx: snapped.dx,
        dy: snapped.dy,
        overlay: {
            xLines: snapped.xLines,
            yLines: snapped.yLines,
            mates,
            rowLabel: row !== undefined && row.length > 1 ? `row of ${row.length}` : null,
        },
    };
}

/**
 * Moveable + Selecto wrappers for the live canvas (v0.56 cheat-sheet wiring).
 * - P0-1: Moveable owns the DOM mid-resize (imperative style writes); the store
 *   commits once in onResizeEnd. Chrome re-measures via updateRect() after
 *   every store-driven geometry change (numeric edit, undo/redo, device).
 * - P0-4 (follow-up): group drag initiates from ANY selected node. A multi
 *   selection renders a group (`targets`) Moveable whose control box IS the
 *   union bounding box — the effective hitbox — so mousedown-drag on any
 *   member moves the whole selection by identical deltas (onDragGroup delta →
 *   moveNodesBy) in one coalesced history window (begin/endGesture) with the
 *   same bounds clamp. Resize/rotate chrome stays single-target (primary).
 * - Selecto marquee multi-selects `.canvas-block` targets; shift unions.
 * Loaded client-only via dynamic(..., { ssr: false }) from StageCanvas.
 */
export default function CanvasMoveable({ stageEl, targetId, width }: CanvasMoveableProps) {
    const beginGesture = useCanvasDoc((state) => state.beginGesture);
    const endGesture = useCanvasDoc((state) => state.endGesture);
    const selectNodes = useCanvasDoc((state) => state.selectNodes);
    const selection = useCanvasDoc((state) => state.selection);
    const selectoRef = useRef<Selecto>(null);
    const moveableRef = useRef<Moveable>(null);
    const [snap, setSnap] = useState<RowSnapOverlay | null>(null);

    const targetX = useCanvasDoc((state) => (targetId ? state.nodes[targetId]?.x : undefined));
    const targetY = useCanvasDoc((state) => (targetId ? state.nodes[targetId]?.y : undefined));
    const targetW = useCanvasDoc((state) => (targetId ? state.nodes[targetId]?.w : undefined));
    const targetH = useCanvasDoc((state) => (targetId ? state.nodes[targetId]?.h : undefined));
    const targetRotation = useCanvasDoc((state) =>
        targetId ? state.nodes[targetId]?.rotation : undefined,
    );
    const selectionKey = selection.join(",");

    // Union-bbox hitbox: every selected block's live element. Dragging any of
    // them drives the group Moveable; moveNodesBy applies the delta to the id
    // list (not the element list) so off-DOM members still follow. Memoized so
    // the targets identity is stable across position re-renders — a fresh
    // array every render would make Moveable re-measure/teardown each frame.
    const groupTargets = useMemo(
        () =>
            selection.length > 1 && stageEl
                ? selection.flatMap((id) => {
                      const element = stageEl.querySelector(`[data-id="${id}"]`);
                      return element instanceof HTMLElement ? [element] : [];
                  })
                : [],
        [stageEl, selection],
    );
    const isGroup = selection.length > 1 && groupTargets.length > 0;

    useEffect(() => {
        if (!targetId && !isGroup) return;
        const frame = requestAnimationFrame(() => {
            moveableRef.current?.updateRect();
        });
        return () => cancelAnimationFrame(frame);
    }, [targetId, targetX, targetY, targetW, targetH, targetRotation, width, selectionKey, isGroup]);

    if (!stageEl) return null;

    return (
        <>
            <Selecto
                container={stageEl}
                hitRate={0}
                onDragEnd={(event) => {
                    // OnDragEnd carries NO `selected` (selecto types: rect+isSelect
                    // only); the live selection must be read from the instance via
                    // getSelectedTargets() — the previously used getSelected() does
                    // not exist, so ids always came back empty and click-select /
                    // reselect never reached the store.
                    const eventSelected = (
                        event as unknown as { selected?: readonly HTMLElement[] }
                    ).selected;
                    const elements =
                        eventSelected ?? selectoRef.current?.getSelectedTargets() ?? [];
                    const ids = elements
                        .map((element) => element.dataset?.id)
                        .filter((id): id is string => Boolean(id));
                    // Empty non-shift results come from dragging off a block (or
                    // Moveable chrome); background deselect is the stage's
                    // pointerdown job, so never let these wipe the selection
                    // Moveable is bound to.
                    if (ids.length === 0 && !event.inputEvent.shiftKey) return;
                    const current = useCanvasDoc.getState().selection;
                    selectNodes(
                        event.inputEvent.shiftKey
                            ? Array.from(new Set([...current, ...ids]))
                            : ids,
                    );
                }}
                onDragStart={(event) => {
                    event.inputEvent.preventDefault();
                }}
                dragCondition={(event) => {
                    // Gestures that begin on the selected block or Moveable's own
                    // chrome belong to Moveable: letting Selecto run them would
                    // marquee-select every block the drag path crosses and commit
                    // that union on dragEnd. Veto at dragCondition — the one gate
                    // selecto evaluates before emit/isTrusted branching.
                    const target = event.inputEvent?.target as HTMLElement | null | undefined;
                    if (!target) return true;
                    if (target.closest("[class*='moveable-']")) return false;
                    const block = target.closest<HTMLElement>(".canvas-block");
                    // Union-bbox hitbox: a press on ANY selected block belongs
                    // to the group Moveable, never to a Selecto marquee.
                    if (block?.dataset.id) {
                        const current = useCanvasDoc.getState().selection;
                        if (current.includes(block.dataset.id)) return false;
                    }
                    return true;
                }}
                ref={selectoRef}
                selectableTargets={[".canvas-block"]}
                selectByClick
                toggleContinueSelect={["shift"]}
            />
            {isGroup ? (
                <Moveable
                    bounds={{ left: 0, top: 0, right: width, bottom: 2000 }}
                    container={stageEl}
                    draggable
                    flushSync={flushSync}
                    onDragGroup={(event) => {
                        const first = event.events[0];
                        if (!first) return;
                        const store = useCanvasDoc.getState();
                        const primaryId = store.selection[0];
                        if (!primaryId) return;
                        const rawDx = Math.round(first.delta[0] ?? 0);
                        const rawDy = Math.round(first.delta[1] ?? 0);
                        if (rawDx === 0 && rawDy === 0) return;
                        const snapped = applyRowSnap(
                            store.nodes,
                            store.selection,
                            primaryId,
                            rawDx,
                            rawDy,
                        );
                        if (snapped.dx === 0 && snapped.dy === 0) return;
                        store.moveNodesBy(store.selection, snapped.dx, snapped.dy);
                        setSnap(snapped.overlay);
                    }}
                    onDragGroupEnd={() => {
                        setSnap(null);
                        endGesture();
                    }}
                    onDragGroupStart={() => beginGesture()}
                    ref={moveableRef}
                    snappable={false}
                    targets={groupTargets}
                />
            ) : targetId ? (
                <Moveable
                    bounds={{ left: 0, top: 0, right: width, bottom: 2000 }}
                    container={stageEl}
                    draggable
                    flushSync={flushSync}
                    onDrag={(event) => {
                        const store = useCanvasDoc.getState();
                        const primary = store.nodes[targetId];
                        if (!primary) return;
                        const ids = store.selection.includes(targetId)
                            ? store.selection
                            : [targetId];
                        const rawDx = Math.round(event.left) - primary.x;
                        const rawDy = Math.round(event.top) - primary.y;
                        const snapped = applyRowSnap(store.nodes, ids, targetId, rawDx, rawDy);
                        store.moveNodesBy(ids, snapped.dx, snapped.dy);
                        setSnap(snapped.overlay);
                    }}
                    onDragEnd={() => {
                        setSnap(null);
                        endGesture();
                    }}
                    onDragStart={() => beginGesture()}
                    onResize={(event) => {
                        event.target.style.width = `${event.width}px`;
                        event.target.style.height = `${event.height}px`;
                        if (event.drag) {
                            event.target.style.transform = event.drag.transform;
                        }
                    }}
                    onResizeEnd={(event) => {
                        const last = event.lastEvent as ResizeCommit | undefined;
                        const store = useCanvasDoc.getState();
                        const node = store.nodes[targetId];
                        if (node && last && typeof last.width === "number") {
                            const nextW = Math.max(1, Math.round(last.width));
                            const nextH = Math.max(
                                1,
                                Math.round(
                                    typeof last.height === "number" ? last.height : node.h,
                                ),
                            );
                            const nextX =
                                typeof last.drag?.left === "number"
                                    ? Math.round(last.drag.left)
                                    : node.x;
                            const nextY =
                                typeof last.drag?.top === "number"
                                    ? Math.round(last.drag.top)
                                    : node.y;
                            if (nextX !== node.x || nextY !== node.y) {
                                store.moveNode(targetId, nextX, nextY);
                            }
                            if (nextW !== node.w || nextH !== node.h) {
                                store.resizeNode(targetId, nextW, nextH);
                            }
                        }
                        endGesture();
                    }}
                    onResizeStart={() => beginGesture()}
                    onRotate={(event) =>
                        useCanvasDoc.getState().rotateNode(targetId, Math.round(event.rotation))
                    }
                    onRotateEnd={() => endGesture()}
                    onRotateStart={() => beginGesture()}
                    origin={false}
                    ref={moveableRef}
                    resizable
                    rotatable
                    snappable={false}
                    target={`[data-id="${targetId}"]`}
                />
            ) : null}
            <SnapGuidesOverlay
                mates={snap?.mates ?? []}
                rowLabel={snap?.rowLabel ?? null}
                xLines={snap?.xLines ?? []}
                yLines={snap?.yLines ?? []}
            />
        </>
    );
}
