"use client";

import { useState } from "react";

import { Box, ChevronDown, ChevronUp, Image, Minus, MousePointerClick, MoveVertical, Trash2, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useCanvasDoc } from "../hooks/useCanvasDoc";
import type { CanvasNode, CanvasNodeType } from "../types/canvas-doc.schema";

const TYPE_ICON: Record<CanvasNodeType, typeof Type> = {
    text: Type,
    image: Image,
    button: MousePointerClick,
    divider: Minus,
    spacer: MoveVertical,
    box: Box,
};

export function layerLabel(node: CanvasNode): string {
    const text = node.props.text;
    if (typeof text === "string" && text.trim().length > 0) {
        return text.trim().slice(0, 28);
    }
    if (node.type === "image" && typeof node.props.alt === "string" && node.props.alt.trim()) {
        return node.props.alt.trim().slice(0, 28);
    }
    return node.type.charAt(0).toUpperCase() + node.type.slice(1);
}

/**
 * Live layer list (T8c): every canvas node in document order (roots, then box
 * children indented). Row click selects, selected row takes the rail-active
 * treatment, per-row trash removes via removeNode. Root rows carry up/down
 * reorder controls driving canvas z-order through reorderNode inside a
 * beginGesture/endGesture pair so each move is one undo step.
 */
export function LayersPanel() {
    const nodes = useCanvasDoc((state) => state.nodes);
    const rootIds = useCanvasDoc((state) => state.rootIds);
    const selection = useCanvasDoc((state) => state.selection);
    const selectNodes = useCanvasDoc((state) => state.selectNodes);
    const removeNode = useCanvasDoc((state) => state.removeNode);
    const beginGesture = useCanvasDoc((state) => state.beginGesture);
    const endGesture = useCanvasDoc((state) => state.endGesture);
    const reorderNode = useCanvasDoc((state) => state.reorderNode);
    const [filter, setFilter] = useState("");

    const rows: { node: CanvasNode; depth: number }[] = [];
    for (const rootId of rootIds) {
        const root = nodes[rootId];
        if (!root) continue;
        rows.push({ node: root, depth: 0 });
        if (root.type === "box") {
            for (const child of Object.values(nodes)) {
                if (child.parentId === root.id) rows.push({ node: child, depth: 1 });
            }
        }
    }

    const query = filter.trim().toLowerCase();
    const visibleRows =
        query.length === 0
            ? rows
            : rows.filter(
                  ({ node }) =>
                      layerLabel(node).toLowerCase().includes(query) ||
                      node.type.includes(query),
              );

    const selectedId = selection[0] ?? null;

    return (
        <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
            <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Layers
                </span>
                <span
                    aria-live="polite"
                    className="tabular-nums text-[10px] font-medium text-muted-foreground"
                >
                    {query.length === 0
                        ? `${rows.length}`
                        : `${visibleRows.length} of ${rows.length}`}
                </span>
            </div>

            <div className="shrink-0 border-b p-2">
                <Input
                    aria-label="Filter layers"
                    className="h-8 text-xs"
                    placeholder="Filter by name or type…"
                    type="search"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {rows.length === 0 ? (
                    <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-muted-foreground">
                        No blocks yet — add one from Elements.
                    </p>
                ) : visibleRows.length === 0 ? (
                    <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-muted-foreground">
                        No layers match “{filter.trim()}”.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-0.5">
                        {visibleRows.map(({ node, depth }) => {
                            const Icon = TYPE_ICON[node.type];
                            const isSelected = node.id === selectedId;
                            const rootIndex = depth === 0 ? rootIds.indexOf(node.id) : -1;
                            const canMoveUp = depth === 0 && rootIndex > 0;
                            const canMoveDown =
                                depth === 0 && rootIndex >= 0 && rootIndex < rootIds.length - 1;
                            const moveLayer = (direction: "up" | "down"): void => {
                                beginGesture();
                                reorderNode(node.id, direction);
                                endGesture();
                            };
                            return (
                                <li key={node.id} style={{ paddingLeft: depth * 12 }}>
                                    <div
                                        aria-pressed={isSelected}
                                        className={cn(
                                            "group relative flex h-8 items-center gap-2 rounded-md pr-1 transition-colors duration-150",
                                            isSelected
                                                ? "bg-primary/10 text-primary"
                                                : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                        )}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => selectNodes([node.id])}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                selectNodes([node.id]);
                                            }
                                        }}
                                    >
                                        {isSelected ? (
                                            <span
                                                aria-hidden="true"
                                                className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
                                            />
                                        ) : null}
                                        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                                            {layerLabel(node)}
                                        </span>
                                        {depth === 0 ? (
                                            <>
                                                <Button
                                                    aria-label={`Move ${node.type} block up`}
                                                    className={cn(
                                                        "size-6 shrink-0 opacity-40 group-hover:opacity-100 focus-visible:opacity-100",
                                                        isSelected && "opacity-100",
                                                    )}
                                                    disabled={!canMoveUp}
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        moveLayer("up");
                                                    }}
                                                >
                                                    <ChevronUp className="size-3.5" />
                                                </Button>
                                                <Button
                                                    aria-label={`Move ${node.type} block down`}
                                                    className={cn(
                                                        "size-6 shrink-0 opacity-40 group-hover:opacity-100 focus-visible:opacity-100",
                                                        isSelected && "opacity-100",
                                                    )}
                                                    disabled={!canMoveDown}
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        moveLayer("down");
                                                    }}
                                                >
                                                    <ChevronDown className="size-3.5" />
                                                </Button>
                                            </>
                                        ) : null}
                                        <Button
                                            aria-label={`Delete ${node.type} block`}
                                            className={cn(
                                                "size-6 shrink-0 opacity-40 group-hover:opacity-100 focus-visible:opacity-100",
                                                isSelected && "opacity-100",
                                            )}
                                            size="icon"
                                            variant="ghost"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                removeNode(node.id);
                                            }}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <div className="shrink-0 border-t p-3">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Click a row to select it. Up/down moves its block through the
                    canvas stack.
                </p>
            </div>
        </aside>
    );
}
