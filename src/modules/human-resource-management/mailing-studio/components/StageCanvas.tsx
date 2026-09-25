"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { MousePointerClick } from "lucide-react";

import { Button } from "@/components/ui/button";

import { clampZoom, useCanvasDoc } from "../hooks/useCanvasDoc";
import type { CanvasNode } from "../types/canvas-doc.schema";
import CanvasNodeView from "./CanvasNodeView";
import { type CanvasBadge, nodeBadges } from "./canvas-badges";

const CanvasMoveable = dynamic(() => import("./CanvasMoveable"), { ssr: false });

// Dot grid: workspace dots use hsl(var(--border)) at 16 px pitch (DESIGN.md §2).
const WORKSPACE_DOTS: CSSProperties = {
    backgroundImage: "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
    backgroundSize: "16px 16px",
};

const PASTE_OFFSET = 16;

let cloneSequence = 0;

function nextCloneId(): string {
    cloneSequence += 1;
    return `paste-${Date.now().toString(36)}-${cloneSequence}`;
}

let canvasClipboard: readonly CanvasNode[] | null = null;

function snapshotClipboard(
    nodes: Readonly<Record<string, CanvasNode>>,
    ids: readonly string[],
): void {
    const picked: CanvasNode[] = [];
    for (const id of ids) {
        const node = nodes[id];
        if (node) picked.push({ ...node, props: { ...node.props } });
    }
    canvasClipboard = picked.length > 0 ? picked : null;
}

function pasteClipboard(): string[] {
    const clip = canvasClipboard;
    if (!clip || clip.length === 0) return [];
    const store = useCanvasDoc.getState();
    const selectedIds = new Set(clip.map((node) => node.id));
    const idMap = new Map<string, string>();
    for (const node of clip) idMap.set(node.id, nextCloneId());
    const rootsFirst = [...clip].sort((a, b) => {
        const aRoot = !selectedIds.has(a.parentId) ? 0 : 1;
        const bRoot = !selectedIds.has(b.parentId) ? 0 : 1;
        return aRoot - bRoot;
    });
    const baseZ = store.rootIds.length;
    let rootOffset = 0;
    const created: string[] = [];
    store.beginGesture();
    for (const node of rootsFirst) {
        const mappedParent = idMap.get(node.parentId);
        const parentId =
            mappedParent && selectedIds.has(node.parentId) ? mappedParent : "stage";
        const createdId = store.addNode({
            ...node,
            id: idMap.get(node.id),
            parentId,
            x: node.x + PASTE_OFFSET,
            y: node.y + PASTE_OFFSET,
            z: parentId === "stage" ? baseZ + rootOffset : node.z,
            props: { ...node.props },
        });
        if (createdId) {
            created.push(createdId);
            if (parentId === "stage") rootOffset += 1;
        }
    }
    store.endGesture();
    return created;
}

function EmptyCanvasCta({ onBrowse }: { readonly onBrowse: () => void }) {
    return (
        <div className="flex min-h-[2000px] flex-col items-center pt-24 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                <MousePointerClick aria-hidden="true" className="size-5" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">Start with a block</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Click a block in Elements to add it to the canvas.
            </p>
            <Button className="mt-4" size="sm" type="button" onClick={onBrowse}>
                Browse elements
            </Button>
        </div>
    );
}

/**
 * Live freeform canvas stage (T8): absolutely-positioned `.canvas-block` divs
 * driven by useCanvasDoc, background-deselect, Moveable gestures on the first
 * selected node (click-select handled by Selecto), Selecto marquee, keyboard
 * Delete / arrows / Escape / Ctrl+A / Ctrl+C+V+D / Ctrl+Z / Ctrl+Y, Ctrl+wheel
 * zoom. History stays inside the store.
 * Artboard-first sizing: the stage keeps its device width and the workspace
 * scrolls on both axes, so blocks never crush below the artboard contract.
 * `width` is the device artboard width (Desktop 600 / Mobile 375); the pill
 * above the stage always shows this live width.
 */
export function StageCanvas({
    width = 600,
    onEmptyAdd,
}: {
    readonly width?: number;
    readonly onEmptyAdd?: () => void;
}) {
    const nodes = useCanvasDoc((state) => state.nodes);
    const rootIds = useCanvasDoc((state) => state.rootIds);
    const selection = useCanvasDoc((state) => state.selection);
    const selectNodes = useCanvasDoc((state) => state.selectNodes);
    const zoom = useCanvasDoc((state) => state.viewport.zoom);

    const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const nodeList = useMemo(() => Object.values(nodes), [nodes]);
    const badgesById = useMemo(() => {
        const map: Record<string, CanvasBadge[]> = {};
        for (const node of nodeList) {
            map[node.id] = nodeBadges(node, nodeList, width);
        }
        return map;
    }, [nodeList, width]);

    const firstSelected = selection[0] ?? null;

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onWheel = (event: WheelEvent): void => {
            if (!(event.ctrlKey || event.metaKey)) return;
            event.preventDefault();
            const store = useCanvasDoc.getState();
            store.setViewport({
                zoom: clampZoom(store.viewport.zoom * Math.exp(-event.deltaY * 0.002)),
            });
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, []);

    // Keyboard: Delete removes, arrows nudge (Shift = 10 px), Escape
    // deselects, Ctrl+A selects all roots, Ctrl+C/V duplicates via the
    // in-app clipboard (+16/+16 offset, new ids, one undo entry), Ctrl+D
    // duplicates in place, Ctrl+Z / Ctrl+Y undo/redo. Mutations are
    // gesture-wrapped so each keypress is one history entry; selection is
    // never in history.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const element = event.target as HTMLElement | null;
            if (
                element &&
                (element.tagName === "INPUT" ||
                    element.tagName === "TEXTAREA" ||
                    element.tagName === "SELECT" ||
                    element.isContentEditable)
            ) {
                return;
            }

            const store = useCanvasDoc.getState();
            const commandKey = event.ctrlKey || event.metaKey;
            const key = event.key.toLowerCase();

            if (commandKey && key === "z") {
                event.preventDefault();
                if (event.shiftKey) store.redo();
                else store.undo();
                return;
            }
            if (commandKey && key === "y") {
                event.preventDefault();
                store.redo();
                return;
            }

            if (commandKey && key === "a") {
                event.preventDefault();
                if (store.rootIds.length > 0) store.selectNodes([...store.rootIds]);
                return;
            }

            if (commandKey && key === "c") {
                if (store.selection.length === 0) return;
                event.preventDefault();
                snapshotClipboard(store.nodes, store.selection);
                return;
            }

            if (commandKey && key === "v") {
                event.preventDefault();
                const created = pasteClipboard();
                if (created.length > 0) store.selectNodes(created);
                return;
            }

            if (commandKey && key === "d") {
                if (store.selection.length === 0) return;
                event.preventDefault();
                snapshotClipboard(store.nodes, store.selection);
                const created = pasteClipboard();
                if (created.length > 0) store.selectNodes(created);
                return;
            }

            if (event.key === "Escape") {
                if (store.selection.length === 0) return;
                event.preventDefault();
                store.selectNodes([]);
                return;
            }

            if (event.key === "Delete" || event.key === "Backspace") {
                if (store.selection.length === 0) return;
                event.preventDefault();
                store.beginGesture();
                for (const id of [...store.selection]) store.removeNode(id);
                store.endGesture();
                return;
            }

            if (event.key.startsWith("Arrow") && store.selection.length > 0) {
                event.preventDefault();
                const step = event.shiftKey ? 10 : 1;
                const dx =
                    event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
                const dy =
                    event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
                store.beginGesture();
                for (const id of store.selection) {
                    const node = store.nodes[id];
                    if (node) store.moveNode(id, node.x + dx, node.y + dy);
                }
                store.endGesture();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <div
            className="relative flex min-w-0 flex-1 flex-col overflow-auto"
            data-studio-scroll
            style={WORKSPACE_DOTS}
            ref={scrollRef}
        >
            <div className="mx-auto flex w-max min-w-full flex-col items-center px-4 py-8">
                <span
                    aria-live="polite"
                    className="mb-3 shrink-0 rounded-full border bg-card px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm tabular-nums"
                >
                    {width} px
                </span>

                <div
                    className="relative shrink-0 rounded-xl border bg-card shadow-xl dark:shadow-black/50"
                    data-stage="canvas"
                    style={{ width, minWidth: width, maxWidth: width, minHeight: 2000, zoom }}
                    onPointerDown={(event) => {
                        if (event.target === event.currentTarget && !event.shiftKey) {
                            selectNodes([]);
                        }
                    }}
                    ref={setStageEl}
                >
                    {rootIds.length === 0 ? (
                        <EmptyCanvasCta onBrowse={() => onEmptyAdd?.()} />
                    ) : (
                        rootIds.map((id) => {
                            const node = nodes[id];
                            if (!node) return null;
                            return (
                                <CanvasNodeView
                                    badgesById={badgesById}
                                    key={id}
                                    node={node}
                                    nodes={nodes}
                                />
                            );
                        })
                    )}
                    <CanvasMoveable stageEl={stageEl} targetId={firstSelected} width={width} />
                </div>
            </div>
        </div>
    );
}
