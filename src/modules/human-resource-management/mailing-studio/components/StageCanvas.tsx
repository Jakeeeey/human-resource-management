"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import { useCanvasDoc } from "../hooks/useCanvasDoc";
import CanvasNodeView from "./CanvasNodeView";
import { type CanvasBadge, nodeBadges } from "./canvas-badges";

const CanvasMoveable = dynamic(() => import("./CanvasMoveable"), { ssr: false });

// Dot grid: workspace dots use hsl(var(--border)) at 16 px pitch (DESIGN.md §2).
const WORKSPACE_DOTS: CSSProperties = {
    backgroundImage: "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
    backgroundSize: "16px 16px",
};

/**
 * Live freeform canvas stage (T8): absolutely-positioned `.canvas-block` divs
 * driven by useCanvasDoc, background-deselect, Moveable gestures on the first
 * selected node (click-select handled by Selecto), Selecto marquee, keyboard
 * Delete / arrows / Ctrl+Z / Ctrl+Y. History stays inside the store.
 * `width` is the device artboard width (Desktop 600 / Mobile 375).
 */
export function StageCanvas({ width = 600 }: { readonly width?: number }) {
    const nodes = useCanvasDoc((state) => state.nodes);
    const rootIds = useCanvasDoc((state) => state.rootIds);
    const selection = useCanvasDoc((state) => state.selection);
    const selectNodes = useCanvasDoc((state) => state.selectNodes);

    const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);

    const nodeList = useMemo(() => Object.values(nodes), [nodes]);
    const badgesById = useMemo(() => {
        const map: Record<string, CanvasBadge[]> = {};
        for (const node of nodeList) {
            map[node.id] = nodeBadges(node, nodeList);
        }
        return map;
    }, [nodeList]);

    const firstSelected = selection[0] ?? null;

    // Keyboard: Delete removes, arrows nudge (Shift = 10 px), Ctrl+Z / Ctrl+Y
    // undo/redo. Mutations are gesture-wrapped so each keypress is one history
    // entry; selection is never in history.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const element = event.target as HTMLElement | null;
            if (
                element &&
                (element.tagName === "INPUT" ||
                    element.tagName === "TEXTAREA" ||
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
        <div className="relative flex min-w-0 flex-1 flex-col" style={WORKSPACE_DOTS}>
            <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-8 sm:px-6">
                <span className="mb-3 shrink-0 rounded-full border bg-card px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm tabular-nums">
                    {width} px
                </span>

                <div
                    className="relative w-full min-h-[2000px] shrink-0 rounded-xl border bg-card shadow-xl dark:shadow-black/50"
                    data-stage="canvas"
                    style={{ maxWidth: width }}
                    onPointerDown={(event) => {
                        if (event.target === event.currentTarget && !event.shiftKey) {
                            selectNodes([]);
                        }
                    }}
                    ref={setStageEl}
                >
                    {rootIds.map((id) => {
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
                    })}
                    <CanvasMoveable stageEl={stageEl} targetId={firstSelected} width={width} />
                </div>
            </div>
        </div>
    );
}
