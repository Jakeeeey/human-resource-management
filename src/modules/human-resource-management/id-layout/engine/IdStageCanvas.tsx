"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { MousePointerClick } from "lucide-react";
import { ID_CARD } from "../types/id-layout.schema";
import type { IdNode, IdPage } from "../types/id-layout.schema";
import { IdNodeView } from "./IdNodeView";
import { activePageOf, clampIdZoom, type IdDocStore } from "./store";

const IdMoveable = dynamic(() => import("./IdMoveable").then((module) => module.IdMoveable), { ssr: false });

export const ID_BLOCK_GAP = 20;

export const ID_SURFACE = {
    width: ID_CARD.width + ID_BLOCK_GAP + ID_CARD.width,
    height: ID_CARD.height,
} as const;

export const ID_BLOCK_OFFSETS = {
    front: 0,
    back: ID_CARD.width + ID_BLOCK_GAP,
} as const;

export type IdCardSide = "front" | "back";

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

function IdEmptyCanvasCta() {
    return (
        <div className="flex min-h-[648px] flex-col items-center pt-24 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                <MousePointerClick aria-hidden="true" className="size-5" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">Start designing</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Add text, an image, a shape, or a variable to this side of the card.
            </p>
        </div>
    );
}

export interface IdStageCanvasProps {
    readonly store: IdDocStore;
    readonly values?: Readonly<Record<string, string>>;
}

interface IdCardBlock {
    readonly side: IdCardSide;
    readonly page: IdPage | null;
    readonly rootIds: readonly string[];
    readonly targetId: string | null;
}

export function IdStageCanvas({ store, values = {} }: IdStageCanvasProps) {
    const nodes = store((state) => state.nodes);
    const pages = store((state) => state.pages);
    const activePageId = store((state) => state.activePageId);
    const selection = store((state) => state.selection);
    const selectNodes = store((state) => state.selectNodes);
    const editingId = store((state) => state.editingId);
    const zoom = store((state) => state.viewport.zoom);

    const [frontBlockEl, setFrontBlockEl] = useState<HTMLDivElement | null>(null);
    const [backBlockEl, setBackBlockEl] = useState<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [spaceHeld, setSpaceHeld] = useState(false);
    const [panning, setPanning] = useState(false);
    const spaceRef = useRef(false);
    const panRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

    const frontPage = pages.find((candidate) => candidate.side === "front") ?? null;
    const backPage = pages.find((candidate) => candidate.side === "back") ?? null;
    const frontRoots = frontPage?.rootIds ?? [];
    const backRoots = backPage?.rootIds ?? [];

    const blocks: readonly IdCardBlock[] = [
        {
            side: "front",
            page: frontPage,
            rootIds: frontRoots,
            targetId: selection.find((id) => frontRoots.includes(id)) ?? null,
        },
        {
            side: "back",
            page: backPage,
            rootIds: backRoots,
            targetId: selection.find((id) => backRoots.includes(id)) ?? null,
        },
    ];
    const blockElements: Record<IdCardSide, HTMLDivElement | null> = {
        front: frontBlockEl,
        back: backBlockEl,
    };
    const blockRefs: Record<IdCardSide, (element: HTMLDivElement | null) => void> = {
        front: setFrontBlockEl,
        back: setBackBlockEl,
    };

    useEffect(() => {
        const onWheel = (event: WheelEvent): void => {
            if (!(event.ctrlKey || event.metaKey)) return;
            const scope = scrollRef.current;
            const target = event.target;
            if (!scope || !(target instanceof HTMLElement) || !scope.contains(target)) return;
            event.preventDefault();
            const current = store.getState();
            current.setViewport({
                zoom: clampIdZoom(current.viewport.zoom * Math.exp(-event.deltaY * 0.002)),
            });
        };
        window.addEventListener("wheel", onWheel, { passive: false, capture: true });
        return () => window.removeEventListener("wheel", onWheel, { capture: true });
    }, [store]);

    useEffect(() => {
        const isSpaceKey = (event: KeyboardEvent): boolean => {
            return event.code === "Space" || event.key === " " || event.key === "Spacebar";
        };
        const shouldIgnoreSpace = (event: KeyboardEvent): boolean => {
            const element = event.target as HTMLElement | null;
            if (!element) return false;
            if (
                element.tagName === "INPUT" ||
                element.tagName === "TEXTAREA" ||
                element.tagName === "SELECT" ||
                element.isContentEditable
            ) {
                return true;
            }
            if (typeof element.closest === "function") {
                const overlay = element.closest(
                    "[role=\"dialog\"],[role=\"alertdialog\"],[role=\"menu\"],[role=\"listbox\"],[data-slot=\"popover-content\"],[data-radix-popper-content-wrapper]",
                );
                if (overlay) return true;
            }
            return false;
        };
        const releaseSpacePan = (): void => {
            const active = panRef.current;
            const scope = scrollRef.current;
            if (active && scope && typeof scope.hasPointerCapture === "function" && scope.hasPointerCapture(active.pointerId)) {
                scope.releasePointerCapture(active.pointerId);
            }
            panRef.current = null;
            spaceRef.current = false;
            setPanning(false);
            setSpaceHeld(false);
        };
        const onSpaceDown = (event: KeyboardEvent): void => {
            if (!isSpaceKey(event)) return;
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (shouldIgnoreSpace(event)) return;
            event.preventDefault();
            if (event.repeat || spaceRef.current) return;
            spaceRef.current = true;
            setSpaceHeld(true);
        };
        const onSpaceUp = (event: KeyboardEvent): void => {
            if (!isSpaceKey(event)) return;
            if (spaceRef.current) event.preventDefault();
            releaseSpacePan();
        };
        window.addEventListener("keydown", onSpaceDown);
        window.addEventListener("keyup", onSpaceUp);
        window.addEventListener("blur", releaseSpacePan);
        return () => {
            window.removeEventListener("keydown", onSpaceDown);
            window.removeEventListener("keyup", onSpaceUp);
            window.removeEventListener("blur", releaseSpacePan);
        };
    }, []);

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
            style={{ ...ID_WORKSPACE_DOTS, cursor: spaceHeld ? (panning ? "grabbing" : "grab") : undefined, touchAction: spaceHeld ? "none" : undefined }}
            ref={scrollRef}
            onPointerDownCapture={(event) => {
                if (!spaceRef.current) return;
                if (event.button !== 0) return;
                event.stopPropagation();
                event.preventDefault();
                const scope = scrollRef.current;
                if (!scope) return;
                panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
                setPanning(true);
                scope.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
                const active = panRef.current;
                if (!active || active.pointerId !== event.pointerId) return;
                const scope = scrollRef.current;
                if (!scope) return;
                const dx = event.clientX - active.x;
                const dy = event.clientY - active.y;
                if (dx === 0 && dy === 0) return;
                scope.scrollLeft -= dx;
                scope.scrollTop -= dy;
                panRef.current = { pointerId: active.pointerId, x: event.clientX, y: event.clientY };
            }}
            onPointerUp={(event) => {
                const active = panRef.current;
                if (!active || active.pointerId !== event.pointerId) return;
                panRef.current = null;
                setPanning(false);
            }}
            onPointerCancel={(event) => {
                const active = panRef.current;
                if (!active || active.pointerId !== event.pointerId) return;
                panRef.current = null;
                setPanning(false);
            }}
        >
            <div className="mx-auto flex w-max min-w-full flex-col items-center px-4 py-8">
                <div className="mb-3 shrink-0" style={{ width: ID_SURFACE.width * zoom }}>
                    <div className="flex" style={{ gap: ID_BLOCK_GAP * zoom }}>
                        {blocks.map((block) => (
                            <div
                                className="flex min-w-0 items-center justify-between gap-2"
                                key={block.side}
                                style={{ width: ID_CARD.width * zoom }}
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                        {block.side}
                                    </span>
                                    {block.page !== null && block.page.id === activePageId ? (
                                        <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                            Editing
                                        </span>
                                    ) : null}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <div
                    className="shrink-0"
                    style={{ width: ID_SURFACE.width * zoom, height: ID_SURFACE.height * zoom }}
                >
                    <div
                        className="relative origin-top-left"
                        style={{
                            width: ID_SURFACE.width,
                            height: ID_SURFACE.height,
                            transform: `scale(${zoom})`,
                            transformOrigin: "top left",
                        }}
                        onPointerDown={(event) => {
                            if (event.target === event.currentTarget) selectNodes([]);
                        }}
                    >
                    <div className="flex" style={{ gap: ID_BLOCK_GAP }}>
                        {blocks.map((block) => (
                            <div
                                className="relative shrink-0 overflow-hidden rounded-xl border bg-card shadow-xl dark:shadow-black/50"
                                data-id-card-block={block.side}
                                key={block.side}
                                style={{ width: ID_CARD.width, height: ID_CARD.height }}
                                onPointerDown={(event) => {
                                    const current = store.getState();
                                    if (block.page && current.activePageId !== block.page.id) {
                                        current.setActivePage(block.page.id);
                                    }
                                    const latest = store.getState();
                                    if (latest.editingId !== null) {
                                        latest.endGesture();
                                        latest.setEditingId(null);
                                        return;
                                    }
                                    if (event.target === event.currentTarget && !event.shiftKey) {
                                        selectNodes([]);
                                    }
                                }}
                                ref={blockRefs[block.side]}
                            >
                                {block.page === null || block.rootIds.length === 0 ? (
                                    <IdEmptyCanvasCta />
                                ) : (
                                    block.rootIds.map((id) => {
                                        const node = nodes[id];
                                        if (!node) return null;
                                        return <IdNodeView key={id} node={node} store={store} values={values} />;
                                    })
                                )}
                                <IdMoveable
                                    store={store}
                                    stageEl={blockElements[block.side]}
                                    targetId={block.targetId}
                                    editing={editingId !== null}
                                    pageId={block.page?.id ?? null}
                                    panning={spaceHeld}
                                />
                            </div>
                        ))}
                    </div>
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute top-0 bottom-0 flex items-center justify-center"
                        style={{ left: ID_BLOCK_OFFSETS.back - ID_BLOCK_GAP, width: ID_BLOCK_GAP }}
                    >
                        <div className="h-full w-px bg-border" />
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
