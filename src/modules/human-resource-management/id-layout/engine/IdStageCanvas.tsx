"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ID_CARD } from "../types/id-layout.schema";
import type { IdNode } from "../types/id-layout.schema";
import { IdNodeView } from "./IdNodeView";
import { activePageOf, clampIdZoom, type IdDocStore } from "./store";

const IdMoveable = dynamic(() => import("./IdMoveable").then((module) => module.IdMoveable), { ssr: false });

const ID_WORKSPACE_DOTS: CSSProperties = {
    backgroundImage: "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
    backgroundSize: "16px 16px",
};

const ID_PASTE_OFFSET = 16;

let idCloneSequence = 0;

function nextIdCloneId(): string {
    idCloneSequence += 1;
    return `id-paste-${Date.now().toString(36)}-${idCloneSequence}`;
}

let idClipboard: readonly IdNode[] | null = null;

function snapshotIdClipboard(nodes: Readonly<Record<string, IdNode>>, ids: readonly string[]): void {
    const picked: IdNode[] = [];
    for (const id of ids) {
        const node = nodes[id];
        if (node) picked.push({ ...node, props: { ...node.props } } as IdNode);
    }
    idClipboard = picked.length > 0 ? picked : null;
}

function pasteIdClipboard(store: IdDocStore): string[] {
    const clip = idClipboard;
    if (!clip || clip.length === 0) return [];
    const state = store.getState();
    const page = activePageOf(state);
    if (!page) return [];
    const baseZ = page.rootIds.length;
    let rootOffset = 0;
    const created: string[] = [];
    state.beginGesture();
    for (const node of clip) {
        const createdId = state.addNode(
            {
                ...node,
                id: nextIdCloneId(),
                parentId: "stage",
                x: node.x + ID_PASTE_OFFSET,
                y: node.y + ID_PASTE_OFFSET,
                z: baseZ + rootOffset,
                props: { ...node.props },
            },
            page.id,
        );
        if (createdId) {
            created.push(createdId);
            rootOffset += 1;
        }
    }
    store.getState().endGesture();
    return created;
}

function IdEmptyCanvasCta({ onBrowse }: { readonly onBrowse: () => void }) {
    return (
        <div className="flex min-h-[648px] flex-col items-center pt-24 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                <MousePointerClick aria-hidden="true" className="size-5" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">Start designing</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Add text, an image, a shape, or a variable to this side of the card.
            </p>
            <Button className="mt-4" size="sm" type="button" onClick={onBrowse}>
                Browse components
            </Button>
        </div>
    );
}

export interface IdStageCanvasProps {
    readonly store: IdDocStore;
    readonly values?: Readonly<Record<string, string>>;
    readonly onEmptyAdd?: () => void;
}

export function IdStageCanvas({ store, values = {}, onEmptyAdd }: IdStageCanvasProps) {
    const nodes = store((state) => state.nodes);
    const activePageId = store((state) => state.activePageId);
    const pages = store((state) => state.pages);
    const selection = store((state) => state.selection);
    const selectNodes = store((state) => state.selectNodes);
    const editingId = store((state) => state.editingId);
    const zoom = store((state) => state.viewport.zoom);

    const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const page = pages.find((candidate) => candidate.id === activePageId) ?? null;
    const pageRootIds = page?.rootIds ?? [];
    const firstSelected = selection[0] ?? null;

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onWheel = (event: WheelEvent): void => {
            if (!(event.ctrlKey || event.metaKey)) return;
            event.preventDefault();
            const current = store.getState();
            current.setViewport({
                zoom: clampIdZoom(current.viewport.zoom * Math.exp(-event.deltaY * 0.002)),
            });
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [store]);

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

            const current = store.getState();
            const commandKey = event.ctrlKey || event.metaKey;
            const key = event.key.toLowerCase();

            if (commandKey && key === "z") {
                event.preventDefault();
                if (event.shiftKey) current.redo();
                else current.undo();
                return;
            }
            if (commandKey && key === "y") {
                event.preventDefault();
                current.redo();
                return;
            }

            if (commandKey && key === "a") {
                const ids = activePageOf(current)?.rootIds ?? [];
                if (ids.length === 0) return;
                event.preventDefault();
                current.selectNodes([...ids]);
                return;
            }

            if (commandKey && key === "c") {
                if (current.selection.length === 0) return;
                event.preventDefault();
                snapshotIdClipboard(current.nodes, current.selection);
                return;
            }

            if (commandKey && key === "v") {
                event.preventDefault();
                const created = pasteIdClipboard(store);
                if (created.length > 0) current.selectNodes(created);
                return;
            }

            if (commandKey && key === "d") {
                if (current.selection.length === 0) return;
                event.preventDefault();
                snapshotIdClipboard(current.nodes, current.selection);
                const created = pasteIdClipboard(store);
                if (created.length > 0) current.selectNodes(created);
                return;
            }

            if (event.key === "Escape") {
                if (current.selection.length === 0) return;
                event.preventDefault();
                current.selectNodes([]);
                return;
            }

            if (event.key === "Delete" || event.key === "Backspace") {
                if (current.selection.length === 0) return;
                event.preventDefault();
                current.beginGesture();
                for (const id of [...current.selection]) current.removeNode(id);
                current.endGesture();
                return;
            }

            if (event.key.startsWith("Arrow") && current.selection.length > 0) {
                event.preventDefault();
                const step = event.shiftKey ? 10 : 1;
                const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
                const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
                current.beginGesture();
                for (const id of current.selection) {
                    const node = current.nodes[id];
                    if (node) current.moveNode(id, node.x + dx, node.y + dy);
                }
                current.endGesture();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [store]);

    return (
        <div
            className="relative flex min-w-0 flex-1 flex-col overflow-auto"
            data-id-studio-scroll
            style={ID_WORKSPACE_DOTS}
            ref={scrollRef}
        >
            <div className="mx-auto flex w-max min-w-full flex-col items-center px-4 py-8">
                <span
                    aria-live="polite"
                    className="mb-3 shrink-0 rounded-full border bg-card px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm tabular-nums"
                >
                    {ID_CARD.width} × {ID_CARD.height}
                </span>

                <div
                    className="relative shrink-0 overflow-hidden rounded-xl border bg-card shadow-xl dark:shadow-black/50"
                    data-stage="id-card"
                    style={{
                        width: ID_CARD.width,
                        minWidth: ID_CARD.width,
                        maxWidth: ID_CARD.width,
                        minHeight: ID_CARD.height,
                        zoom,
                    }}
                    onPointerDown={(event) => {
                        if (editingId !== null) {
                            const current = store.getState();
                            current.endGesture();
                            current.setEditingId(null);
                            return;
                        }
                        if (event.target === event.currentTarget && !event.shiftKey) {
                            selectNodes([]);
                        }
                    }}
                    ref={setStageEl}
                >
                    {page === null || pageRootIds.length === 0 ? (
                        <IdEmptyCanvasCta onBrowse={() => onEmptyAdd?.()} />
                    ) : (
                        pageRootIds.map((id) => {
                            const node = nodes[id];
                            if (!node) return null;
                            return <IdNodeView key={id} node={node} store={store} values={values} />;
                        })
                    )}
                    <IdMoveable store={store} stageEl={stageEl} targetId={firstSelected} editing={editingId !== null} />
                </div>
            </div>
        </div>
    );
}
