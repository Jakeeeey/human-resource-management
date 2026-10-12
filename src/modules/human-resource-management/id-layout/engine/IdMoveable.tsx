"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Moveable from "react-moveable";
import Selecto from "react-selecto";
import { ID_CARD } from "../types/id-layout.schema";
import { IdSnapGuidesOverlay } from "./IdNodeView";
import { snapIdDrag, type IdSnapOverlay } from "./snap";
import type { IdDocStore } from "./store";

interface IdMoveableProps {
    readonly store: IdDocStore;
    readonly stageEl: HTMLDivElement | null;
    readonly targetId: string | null;
    readonly editing: boolean;
}

interface ResizeCommit {
    readonly width?: number;
    readonly height?: number;
    readonly drag?: { readonly left?: number; readonly top?: number };
}

export function IdMoveable({ store, stageEl, targetId, editing }: IdMoveableProps) {
    const beginGesture = store((state) => state.beginGesture);
    const endGesture = store((state) => state.endGesture);
    const selectNodes = store((state) => state.selectNodes);
    const selection = store((state) => state.selection);
    const zoom = store((state) => state.viewport.zoom);
    const selectoRef = useRef<Selecto>(null);
    const moveableRef = useRef<Moveable>(null);
    const [snap, setSnap] = useState<IdSnapOverlay | null>(null);

    const targetX = store((state) => (targetId ? state.nodes[targetId]?.x : undefined));
    const targetY = store((state) => (targetId ? state.nodes[targetId]?.y : undefined));
    const targetW = store((state) => (targetId ? state.nodes[targetId]?.w : undefined));
    const targetH = store((state) => (targetId ? state.nodes[targetId]?.h : undefined));
    const targetRotation = store((state) => (targetId ? state.nodes[targetId]?.rotation : undefined));
    const selectionKey = selection.join(",");

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
    }, [targetId, targetX, targetY, targetW, targetH, targetRotation, selectionKey, isGroup]);

    const snapFor = (ids: readonly string[], primaryId: string, rawDx: number, rawDy: number) => {
        const state = store.getState();
        const page = state.pages.find((candidate) => candidate.id === state.activePageId) ?? null;
        return snapIdDrag(state.nodes, page?.rootIds ?? [], ids, primaryId, rawDx, rawDy, state.snapEnabled);
    };

    if (!stageEl) return null;

    return (
        <>
            <Selecto
                container={stageEl}
                hitRate={0}
                onDragEnd={(event) => {
                    const eventSelected = (event as unknown as { selected?: readonly HTMLElement[] }).selected;
                    const elements = eventSelected ?? selectoRef.current?.getSelectedTargets() ?? [];
                    const ids = elements.map((element) => element.dataset?.id).filter((id): id is string => Boolean(id));
                    if (ids.length === 0 && !event.inputEvent.shiftKey) return;
                    const current = store.getState().selection;
                    selectNodes(event.inputEvent.shiftKey ? Array.from(new Set([...current, ...ids])) : ids);
                }}
                onDragStart={(event) => {
                    event.inputEvent.preventDefault();
                }}
                dragCondition={(event) => {
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
                selectableTargets={[".id-block"]}
                selectByClick={!editing}
                toggleContinueSelect={["shift"]}
            />
            {editing ? null : isGroup ? (
                <Moveable
                    bounds={{ left: 0, top: 0, right: ID_CARD.width, bottom: ID_CARD.height }}
                    container={stageEl}
                    draggable
                    flushSync={flushSync}
                    onDragGroup={(event) => {
                        const first = event.events[0];
                        if (!first) return;
                        const current = store.getState();
                        const primaryId = current.selection[0];
                        if (!primaryId) return;
                        const rawDx = Math.round(first.delta[0] ?? 0);
                        const rawDy = Math.round(first.delta[1] ?? 0);
                        if (rawDx === 0 && rawDy === 0) return;
                        const snapped = snapFor(current.selection, primaryId, rawDx, rawDy);
                        if (snapped.dx === 0 && snapped.dy === 0) return;
                        current.moveNodesBy(current.selection, snapped.dx, snapped.dy);
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
                    zoom={zoom}
                />
            ) : targetId ? (
                <Moveable
                    bounds={{ left: 0, top: 0, right: ID_CARD.width, bottom: ID_CARD.height }}
                    container={stageEl}
                    draggable
                    flushSync={flushSync}
                    onDrag={(event) => {
                        const current = store.getState();
                        const primary = current.nodes[targetId];
                        if (!primary) return;
                        const ids = current.selection.includes(targetId) ? current.selection : [targetId];
                        const rawDx = Math.round(event.left) - primary.x;
                        const rawDy = Math.round(event.top) - primary.y;
                        const snapped = snapFor(ids, targetId, rawDx, rawDy);
                        current.moveNodesBy(ids, snapped.dx, snapped.dy);
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
                        const current = store.getState();
                        const node = current.nodes[targetId];
                        if (node && last && typeof last.width === "number") {
                            const nextW = Math.max(1, Math.round(last.width));
                            const nextH = Math.max(1, Math.round(typeof last.height === "number" ? last.height : node.h));
                            const nextX = typeof last.drag?.left === "number" ? Math.round(last.drag.left) : node.x;
                            const nextY = typeof last.drag?.top === "number" ? Math.round(last.drag.top) : node.y;
                            if (nextX !== node.x || nextY !== node.y) {
                                current.moveNode(targetId, nextX, nextY);
                            }
                            if (nextW !== node.w || nextH !== node.h) {
                                current.resizeNode(targetId, nextW, nextH);
                            }
                        }
                        endGesture();
                    }}
                    onResizeStart={() => beginGesture()}
                    onRotate={(event) => store.getState().rotateNode(targetId, Math.round(event.rotation))}
                    onRotateEnd={() => endGesture()}
                    onRotateStart={() => beginGesture()}
                    origin={false}
                    ref={moveableRef}
                    resizable
                    rotatable
                    snappable={false}
                    target={`[data-id="${targetId}"]`}
                    zoom={zoom}
                />
            ) : null}
            <IdSnapGuidesOverlay xLines={snap?.xLines ?? []} yLines={snap?.yLines ?? []} />
        </>
    );
}
