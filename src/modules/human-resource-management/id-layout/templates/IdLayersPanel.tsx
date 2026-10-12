"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Image as ImageIcon, Shapes, Trash2, Type, Variable } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { IdNode } from "../types/id-layout.schema";
import type { IdDocStore } from "../engine/store";
import { idNodeText } from "../engine/IdCardNode";

function idLayerLabel(node: IdNode): string {
    if (node.type === "variable") {
        const field = typeof node.props.field === "string" ? node.props.field : "variable";
        return `Variable · ${field}`;
    }
    if (node.type === "text") {
        const text = idNodeText(node).replace(/<[^>]*>/g, "").trim().slice(0, 28);
        if (text.length > 0) return text;
        return "Text";
    }
    if (node.type === "image") {
        if (node.props.source === "field") {
            return `Image · ${typeof node.props.field === "string" ? node.props.field : "field"}`;
        }
        return "Image · upload";
    }
    const shape = typeof node.props.shape === "string" ? node.props.shape : "shape";
    return `Shape · ${shape}`;
}

function idLayerIcon(node: IdNode) {
    if (node.type === "text") return Type;
    if (node.type === "variable") return Variable;
    if (node.type === "image") return ImageIcon;
    return Shapes;
}

export function IdLayersPanel({ store }: { readonly store: IdDocStore }) {
    const nodes = store((state) => state.nodes);
    const pages = store((state) => state.pages);
    const activePageId = store((state) => state.activePageId);
    const selection = store((state) => state.selection);
    const selectNodes = store((state) => state.selectNodes);
    const removeNode = store((state) => state.removeNode);
    const reorderNode = store((state) => state.reorderNode);
    const beginGesture = store((state) => state.beginGesture);
    const endGesture = store((state) => state.endGesture);
    const [filter, setFilter] = useState("");

    const page = pages.find((candidate) => candidate.id === activePageId) ?? null;
    const rootIds = page?.rootIds ?? [];
    const rows = rootIds
        .map((id) => nodes[id])
        .filter((node): node is IdNode => node !== undefined)
        .sort((a, b) => a.z - b.z);

    const query = filter.trim().toLowerCase();
    const visible = query === "" ? rows : rows.filter((node) => idLayerLabel(node).toLowerCase().includes(query) || node.type.includes(query));
    const selectedId = selection[0] ?? null;

    return (
        <aside aria-label="Layers" className="flex min-h-0 w-full flex-1 flex-col bg-card">
            <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Layers</span>
                <span aria-live="polite" className="text-[10px] font-medium tabular-nums text-muted-foreground">
                    {query === "" ? `${rows.length}` : `${visible.length} of ${rows.length}`}
                </span>
            </div>
            <div className="shrink-0 border-b p-2">
                <Input
                    aria-label="Filter layers"
                    className="h-8 text-xs"
                    placeholder="Filter layers…"
                    type="search"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {rows.length === 0 ? (
                    <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-muted-foreground">
                        No blocks on this side yet.
                    </p>
                ) : visible.length === 0 ? (
                    <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-muted-foreground">
                        No layers match the filter.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-0.5">
                        {visible.map((node) => {
                            const Icon = idLayerIcon(node);
                            const isSelected = node.id === selectedId;
                            const index = rootIds.indexOf(node.id);
                            const canMoveUp = index > 0;
                            const canMoveDown = index >= 0 && index < rootIds.length - 1;
                            const moveLayer = (direction: "up" | "down"): void => {
                                beginGesture();
                                reorderNode(node.id, direction);
                                endGesture();
                            };
                            return (
                                <li key={node.id}>
                                    <div
                                        aria-pressed={isSelected}
                                        className={cn(
                                            "group relative flex h-8 items-center gap-2 rounded-md pr-1 transition-colors duration-150",
                                            isSelected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                        )}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => selectNodes([node.id])}
                                        onKeyDown={(event) => {
                                            if (event.target !== event.currentTarget) return;
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                selectNodes([node.id]);
                                            }
                                        }}
                                    >
                                        {isSelected ? (
                                            <span aria-hidden="true" className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                                        ) : null}
                                        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                                        <span className="min-w-0 flex-1 truncate text-xs font-medium">{idLayerLabel(node)}</span>
                                        <Button
                                            aria-label="Move block up"
                                            className={cn("size-6 shrink-0 opacity-40 group-hover:opacity-100 focus-visible:opacity-100", isSelected && "opacity-100")}
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
                                            aria-label="Move block down"
                                            className={cn("size-6 shrink-0 opacity-40 group-hover:opacity-100 focus-visible:opacity-100", isSelected && "opacity-100")}
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
                                        <Button
                                            aria-label="Delete block"
                                            className={cn("size-6 shrink-0 opacity-40 group-hover:opacity-100 focus-visible:opacity-100", isSelected && "opacity-100")}
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
        </aside>
    );
}
