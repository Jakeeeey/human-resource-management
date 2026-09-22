"use client";

import { useCanvasDoc } from "../hooks/useCanvasDoc";
import type { CanvasNode } from "../types/canvas-doc.schema";
import { cn } from "@/lib/utils";
import type { CanvasBadge } from "./canvas-badges";

interface CanvasNodeViewProps {
    readonly node: CanvasNode;
    readonly nodes: Readonly<Record<string, CanvasNode>>;
    readonly badgesById: Readonly<Record<string, readonly CanvasBadge[]>>;
}

function NodeBody({ node }: { readonly node: CanvasNode }) {
    switch (node.type) {
        case "text":
            return (
                <p className="h-full w-full overflow-hidden p-1.5 text-sm leading-relaxed text-foreground">
                    {typeof node.props.text === "string" ? node.props.text : "Text"}
                </p>
            );
        case "button":
            return (
                <span className="flex h-full w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                    {typeof node.props.text === "string" ? node.props.text : "Button"}
                </span>
            );
        case "divider":
            return (
                <div className="flex h-full items-center">
                    <div className="h-px w-full bg-border" />
                </div>
            );
        case "image":
            return (
                <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-border bg-muted text-[11px] text-muted-foreground">
                    Image
                </div>
            );
        case "box":
            return (
                <div className="h-full w-full rounded-md border border-dashed border-border/70 bg-muted/30" />
            );
        case "spacer":
            return null;
    }
}

/**
 * One absolutely-positioned `.canvas-block` for a canvas node (left/top/w/h from
 * the store, rotation via transform). Renders depth-1 children inside box nodes
 * and the live state badges (ROTATED / OVERLAP / CLIPPED) counter-rotated so
 * they stay readable.
 */
export default function CanvasNodeView({ node, nodes, badgesById }: CanvasNodeViewProps) {
    const selected = useCanvasDoc((state) => state.selection.includes(node.id));
    const badges = badgesById[node.id] ?? [];
    const children = Object.values(nodes).filter((child) => child.parentId === node.id);

    return (
        <div
            className={cn(
                "canvas-block absolute rounded-md border border-border/60 bg-background transition-shadow duration-150",
                selected
                    ? "ring-2 ring-primary"
                    : "hover:ring-1 hover:ring-primary/50",
            )}
            data-id={node.id}
            style={{
                left: node.x,
                top: node.y,
                width: node.w,
                height: node.h,
                transform: `rotate(${node.rotation}deg)`,
                zIndex: node.z,
            }}
        >
            {badges.length > 0 ? (
                <div
                    className="pointer-events-none absolute -top-3 right-1 z-10 flex gap-1"
                    style={{ transform: `rotate(${-node.rotation}deg)` }}
                >
                    {badges.map((badge) => (
                        <span
                            className="badge-info rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide shadow-sm"
                            key={badge}
                        >
                            {badge}
                        </span>
                    ))}
                </div>
            ) : null}
            <NodeBody node={node} />
            {children.map((child) => (
                <CanvasNodeView
                    badgesById={badgesById}
                    key={child.id}
                    node={child}
                    nodes={nodes}
                />
            ))}
        </div>
    );
}
