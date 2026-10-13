"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Moveable from "react-moveable";
import Selecto from "react-selecto";
import { ID_CARD } from "../types/id-layout.schema";
import { IdSnapGuidesOverlay } from "./IdNodeView";
import { snapIdDrag, snapIdResize, type IdSnapOverlay } from "./snap";
import type { IdDocStore } from "./store";

interface IdMoveableProps {
    readonly store: IdDocStore;
    readonly stageEl: HTMLDivElement | null;
    readonly targetId: string | null;
    readonly editing: boolean;
    readonly pageId: string | null;
    readonly panning: boolean;
}

interface ResizeCommit {
    readonly width?: number;
    readonly height?: number;
    readonly direction?: readonly number[];
    readonly drag?: { readonly left?: number; readonly top?: number; readonly transform?: string };
}

export function IdMoveable({ store, stageEl, targetId, editing, pageId, panning }: IdMoveableProps) {
    const beginGesture = store((state) => state.beginGesture);
    const endGesture = store((state) => state.endGesture);
    const selectNodes = store((state) => state.selectNodes);
    const selection = store((state) => state.selection);
    const zoom = store((state) => state.viewport.zoom);
    const selectoRef = useRef<Selecto>(null);
    const moveableRef = useRef<Moveable>(null);
    const resizeStartRef = useRef<{ readonly x: number; readonly y: number; readonly w: number; readonly h: number } | null>(null);
    const [snap, setSnap] = useState<IdSnapOverlay | null>(null);

    const targetX = store((state) => (targetId ? state.nodes[targetId]?.x : undefined));
    const targetY = store((state) => (targetId ? state.nodes[targetId]?.y : undefined));
    const targetW = store((state) => (targetId ? state.nodes[targetId]?.w : undefined));
    const targetH = store((state) => (targetId ? state.nodes[targetId]?.h : undefined));
    const targetRotation = store((state) => (targetId ? state.nodes[targetId]?.rotation : undefined));
    const targetLocked = store((state) => (targetId ? (state.nodes[targetId]?.locked ?? false) : false));
    const lockedKey = store((state) => state.selection.filter((id) => state.nodes[id]?.locked).join(","));
    const selectionKey = selection.join(",");

    const lockedSet = useMemo(() => new Set(lockedKey === "" ? [] : lockedKey.split(",")), [lockedKey]);

    const groupTargets = useMemo(
        () =>
            selection.length > 1 && stageEl
                ? selection.flatMap((id) => {
                      if (lockedSet.has(id)) return [];
                      const element = stageEl.querySelector(`[data-id="${id}"]`);
                      return element instanceof HTMLElement ? [element] : [];
                  })
                : [],
        [stageEl, selection, lockedSet],
    );
    const isGroup = selection.length > 1 && groupTargets.length > 0;

    useEffect(() => {
        if (!targetId && !isGroup) return;
        const frame = requestAnimationFrame(() => {
            moveableRef.current?.updateRect();
        });
        return () => cancelAnimationFrame(frame);
    }, [targetId, targetX, targetY, targetW, targetH, targetRotation, selectionKey, isGroup]);

    const snapFor = (ids: readonly string[], primaryId: string, rawDx: number, rawDy: number) => {
        const state = store.getState();
        const page = state.pages.find((candidate) => candidate.id === (pageId ?? state.activePageId)) ?? null;
        return snapIdDrag(state.nodes, page?.rootIds ?? [], ids, primaryId, rawDx, rawDy, state.snapEnabled);
    };

    const ownedIdsOf = (ids: readonly string[]): string[] => {
        const state = store.getState();
        const page = state.pages.find((candidate) => candidate.id === (pageId ?? state.activePageId)) ?? null;
        const roots = page?.rootIds ?? [];
        return ids.filter((id) => roots.includes(id));
    };

    const snapResizeFor = (
        resizingId: string,
        proposed: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
        direction: readonly number[],
    ) => {
        const state = store.getState();
        const page = state.pages.find((candidate) => candidate.id === (pageId ?? state.activePageId)) ?? null;
        return snapIdResize(state.nodes, page?.rootIds ?? [], resizingId, proposed, direction, state.snapEnabled);
    };

    const inferResizeDirection = (
        original: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
        proposed: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
    ): readonly number[] => {
        const dirX = proposed.x !== original.x ? -1 : proposed.w !== original.w ? 1 : 0;
        const dirY = proposed.y !== original.y ? -1 : proposed.h !== original.h ? 1 : 0;
        return [dirX, dirY];
    };

    if (!stageEl) return null;

    const allowMove = !panning;
    // react-moveable's `zoom` prop scales its own control elements
    // ("Zooms in the elements of a moveable", default 1): each control is
    // rendered 14px * zoom, then the browser scales it again by the
    // ancestor transform scale. The control box lives inside the scaled
    // surface, so screen size = 14 * zoomProp * zoom. Passing the inverse
    // keeps handles a constant 14px on screen at any canvas zoom.
    const moveableZoom = zoom > 0 ? 1 / zoom : 1;

    return (
        <>
            <Selecto
                container={stageEl}
                hitRate={0}
                onDragEnd={(event) => {
                    const eventSelected = (event as unknown as { selected?: readonly HTMLElement[] }).selected;
                    const elements = eventSelected ?? selectoRef.current?.getSelectedTargets() ?? [];
                    const ids = elements
                        .map((element) => element.dataset?.id)
                        .filter((id): id is string => Boolean(id))
                        .filter((id) => !store.getState().nodes[id]?.locked);
                    if (ids.length === 0 && !event.inputEvent.shiftKey) return;
                    const current = store.getState().selection;
                    selectNodes(event.inputEvent.shiftKey ? Array.from(new Set([...current, ...ids])) : ids);
                }}
                onSelect={(event) => {
                    const selected = (event as unknown as { selected?: readonly HTMLElement[] }).selected ?? [];
                    const unlocked = selected.filter((element) => !store.getState().nodes[element.dataset?.id ?? ""]?.locked);
                    if (unlocked.length === selected.length) return;
                    selectoRef.current?.setSelectedTargets(unlocked);
                    const ids = unlocked.map((element) => element.dataset?.id).filter((id): id is string => Boolean(id));
                    const current = store.getState().selection;
                    selectNodes(event.inputEvent.shiftKey ? Array.from(new Set([...current, ...ids])) : ids);
                }}
                onSelectEnd={(event) => {
                    const selected = (event as unknown as { selected?: readonly HTMLElement[] }).selected ?? selectoRef.current?.getSelectedTargets() ?? [];
                    const current = store.getState().selection;
                    if (current.some((id) => store.getState().nodes[id]?.locked)) {
                        selectNodes(current.filter((id) => !store.getState().nodes[id]?.locked));
                        return;
                    }
                    const ids = selected.map((element) => element.dataset?.id).filter((id): id is string => Boolean(id));
                    if (ids.length === 0 && !event.inputEvent.shiftKey) selectNodes(current);
                }}
                onDragStart={(event) => {
                    event.inputEvent.preventDefault();
                }}
                dragCondition={(event) => {
                    if (panning) return false;
                    const target = event.inputEvent?.target as HTMLElement | null | undefined;
                    if (!target) return true;
                    if (target.closest("[data-id-editing]")) return false;
                    if (target.closest("[class*='moveable-']")) return false;
                    const block = target.closest<HTMLElement>(".id-block");
                    if (block?.dataset.id) {
                        const current = store.getState().selection;
                        if (current.includes(block.dataset.id)) return false;
                    }
                    return true;
                }}
                ref={selectoRef}
                rootContainer={stageEl.ownerDocument.body}
                selectableTargets={[".id-block"]}
                selectByClick={!editing && allowMove}
                toggleContinueSelect={["shift"]}
            />
            {editing ? null : isGroup ? (
                <Moveable
                    bounds={{ left: 0, top: 0, right: ID_CARD.width, bottom: ID_CARD.height }}
                    container={stageEl}
                    draggable={allowMove}
                    flushSync={flushSync}
                    onDragGroup={(event) => {
                        const first = event.events[0];
                        if (!first) return;
                        const current = store.getState();
                        const owned = ownedIdsOf(current.selection);
                        const primaryId = owned[0];
                        if (!primaryId) return;
                        const rawDx = Math.round(first.delta[0] ?? 0);
                        const rawDy = Math.round(first.delta[1] ?? 0);
                        if (rawDx === 0 && rawDy === 0) return;
                        const snapped = snapFor(owned, primaryId, rawDx, rawDy);
                        if (snapped.dx === 0 && snapped.dy === 0) return;
                        current.moveNodesBy(owned, snapped.dx, snapped.dy);
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
                    zoom={moveableZoom}
                />
            ) : targetId && !targetLocked ? (
                <Moveable
                    bounds={{ left: 0, top: 0, right: ID_CARD.width, bottom: ID_CARD.height }}
                    container={stageEl}
                    draggable={allowMove}
                    flushSync={flushSync}
                    onDrag={(event) => {
                        const current = store.getState();
                        const primary = current.nodes[targetId];
                        if (!primary) return;
                        const owned = ownedIdsOf(current.selection.includes(targetId) ? current.selection : [targetId]);
                        if (owned.length === 0 || !owned.includes(targetId)) return;
                        const rawDx = Math.round(event.left) - primary.x;
                        const rawDy = Math.round(event.top) - primary.y;
                        const snapped = snapFor(owned, targetId, rawDx, rawDy);
                        current.moveNodesBy(owned, snapped.dx, snapped.dy);
                        setSnap(snapped.overlay);
                    }}
                    onDragEnd={() => {
                        setSnap(null);
                        endGesture();
                    }}
                    onDragStart={() => beginGesture()}
                    onResize={(event) => {
                        const current = store.getState();
                        const node = current.nodes[targetId];
                        if (!node) {
                            event.target.style.width = `${event.width}px`;
                            event.target.style.height = `${event.height}px`;
                            if (event.drag) {
                                event.target.style.transform = event.drag.transform;
                            }
                            return;
                        }
                        const start = resizeStartRef.current ?? node;
                        const rawDirection = (event as unknown as { readonly direction?: unknown }).direction;
                        const rawDist = (event as unknown as { readonly dist?: unknown }).dist;
                        const direction: readonly number[] = Array.isArray(rawDirection)
                            ? (rawDirection as readonly number[])
                            : inferResizeDirection(start, {
                                  x:
                                      typeof event.drag?.left === "number"
                                          ? Math.round(event.drag.left)
                                          : start.x,
                                  y:
                                      typeof event.drag?.top === "number"
                                          ? Math.round(event.drag.top)
                                          : start.y,
                                  w: Math.max(1, Math.round(event.width)),
                                  h: Math.max(1, Math.round(event.height)),
                              });
                        const dirX = direction[0] === undefined ? 0 : direction[0] < 0 ? -1 : direction[0] > 0 ? 1 : 0;
                        const dirY = direction[1] === undefined ? 0 : direction[1] < 0 ? -1 : direction[1] > 0 ? 1 : 0;
                        let proposed: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
                        if (
                            Array.isArray(rawDist) &&
                            typeof rawDist[0] === "number" &&
                            Number.isFinite(rawDist[0]) &&
                            typeof rawDist[1] === "number" &&
                            Number.isFinite(rawDist[1])
                        ) {
                            const absoluteW = Math.max(1, Math.round(start.w + (rawDist[0] as number)));
                            const absoluteH = Math.max(1, Math.round(start.h + (rawDist[1] as number)));
                            proposed = {
                                x: dirX < 0 ? start.x + start.w - absoluteW : start.x,
                                y: dirY < 0 ? start.y + start.h - absoluteH : start.y,
                                w: absoluteW,
                                h: absoluteH,
                            };
                        } else {
                            const fallbackW = Math.max(1, Math.round(event.width));
                            const fallbackH = Math.max(1, Math.round(event.height));
                            proposed = {
                                x:
                                    typeof event.drag?.left === "number"
                                        ? Math.round(event.drag.left)
                                        : start.x,
                                y:
                                    typeof event.drag?.top === "number"
                                        ? Math.round(event.drag.top)
                                        : start.y,
                                w: fallbackW,
                                h: fallbackH,
                            };
                        }
                        const snapped = snapResizeFor(targetId, proposed, direction);
                        event.target.style.width = `${snapped.w}px`;
                        event.target.style.height = `${snapped.h}px`;
                        if (event.drag) {
                            const shiftX = snapped.x - start.x;
                            const shiftY = snapped.y - start.y;
                            if (node.rotation === 0) {
                                if (shiftX === 0 && shiftY === 0) {
                                    event.target.style.transform = event.drag.transform;
                                } else {
                                    event.target.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
                                }
                            } else if (shiftX === 0 && shiftY === 0) {
                                event.target.style.transform = event.drag.transform;
                            } else {
                                event.target.style.transform = `translate(${shiftX}px, ${shiftY}px) rotate(${node.rotation}deg)`;
                            }
                        }
                        setSnap(snapped.overlay);
                    }}
                    onResizeEnd={(event) => {
                        const last = event.lastEvent as ResizeCommit | undefined;
                        const current = store.getState();
                        const node = current.nodes[targetId];
                        const start = resizeStartRef.current ?? node ?? null;
                        resizeStartRef.current = null;
                        setSnap(null);
                        if (node && start && last && typeof last.width === "number") {
                            const lastDirection: readonly number[] | null = Array.isArray(last.direction)
                                ? last.direction
                                : null;
                            const lastDist = (last as unknown as { readonly dist?: unknown }).dist;
                            let proposed: {
                                readonly x: number;
                                readonly y: number;
                                readonly w: number;
                                readonly h: number;
                            };
                            let direction: readonly number[];
                            if (
                                Array.isArray(lastDist) &&
                                typeof lastDist[0] === "number" &&
                                Number.isFinite(lastDist[0]) &&
                                typeof lastDist[1] === "number" &&
                                Number.isFinite(lastDist[1])
                            ) {
                                direction =
                                    lastDirection ??
                                    inferResizeDirection(start, {
                                        x:
                                            typeof last.drag?.left === "number"
                                                ? Math.round(last.drag.left)
                                                : start.x,
                                        y:
                                            typeof last.drag?.top === "number"
                                                ? Math.round(last.drag.top)
                                                : start.y,
                                        w: Math.max(1, Math.round(last.width)),
                                        h: Math.max(
                                            1,
                                            Math.round(
                                                typeof last.height === "number" ? last.height : start.h,
                                            ),
                                        ),
                                    });
                                const dirX = direction[0] === undefined ? 0 : direction[0] < 0 ? -1 : direction[0] > 0 ? 1 : 0;
                                const dirY = direction[1] === undefined ? 0 : direction[1] < 0 ? -1 : direction[1] > 0 ? 1 : 0;
                                const absoluteW = Math.max(1, Math.round(start.w + (lastDist[0] as number)));
                                const absoluteH = Math.max(1, Math.round(start.h + (lastDist[1] as number)));
                                proposed = {
                                    x: dirX < 0 ? start.x + start.w - absoluteW : start.x,
                                    y: dirY < 0 ? start.y + start.h - absoluteH : start.y,
                                    w: absoluteW,
                                    h: absoluteH,
                                };
                            } else {
                                const fallbackW = Math.max(1, Math.round(last.width));
                                const fallbackH = Math.max(
                                    1,
                                    Math.round(typeof last.height === "number" ? last.height : node.h),
                                );
                                proposed = {
                                    x:
                                        typeof last.drag?.left === "number"
                                            ? Math.round(last.drag.left)
                                            : node.x,
                                    y:
                                        typeof last.drag?.top === "number"
                                            ? Math.round(last.drag.top)
                                            : node.y,
                                    w: fallbackW,
                                    h: fallbackH,
                                };
                                direction = lastDirection ?? inferResizeDirection(node, proposed);
                            }
                            const snapped = snapResizeFor(targetId, proposed, direction);
                            if (snapped.x !== node.x || snapped.y !== node.y) {
                                current.moveNode(targetId, snapped.x, snapped.y);
                            }
                            if (snapped.w !== node.w || snapped.h !== node.h) {
                                current.resizeNode(targetId, snapped.w, snapped.h);
                            }
                        }
                        endGesture();
                    }}
                    onResizeStart={() => {
                        const node = store.getState().nodes[targetId];
                        resizeStartRef.current = node
                            ? { x: node.x, y: node.y, w: node.w, h: node.h }
                            : null;
                        beginGesture();
                    }}
                    onRotate={(event) => store.getState().rotateNode(targetId, Math.round(event.rotation))}
                    onRotateEnd={() => endGesture()}
                    onRotateStart={() => beginGesture()}
                    origin={false}
                    ref={moveableRef}
                    resizable={!panning}
                    rotatable={!panning}
                    snappable={false}
                    target={`[data-id="${targetId}"]`}
                    zoom={moveableZoom}
                />
            ) : null}
            <IdSnapGuidesOverlay xLines={snap?.xLines ?? []} yLines={snap?.yLines ?? []} />
        </>
    );
}
