"use client";

import { useCanvasDoc } from "../hooks/useCanvasDoc";
import {
    blockPaddingFallback,
    resolveStyleValue,
    type CanvasNode,
} from "../types/canvas-doc.schema";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";
import type { CanvasBadge } from "./canvas-badges";
import { layerLabel } from "./LayersPanel";

interface CanvasNodeViewProps {
    readonly node: CanvasNode;
    readonly nodes: Readonly<Record<string, CanvasNode>>;
    readonly badgesById: Readonly<Record<string, readonly CanvasBadge[]>>;
}

/** Live canvas rendering of block style props — resolves through the shared
 * fidelity contract, so the canvas shows exactly what export emits. */
function blockStyle(node: CanvasNode): CSSProperties {
    const style: CSSProperties = {};
    const get = (key: string): string | number | undefined =>
        resolveStyleValue(node.type, node.props, key);
    const color = get("color");
    if (typeof color === "string") style.color = color;
    const fontSize = get("fontSize");
    if (typeof fontSize === "number") style.fontSize = fontSize;
    const fontFamily = get("fontFamily");
    if (typeof fontFamily === "string") style.fontFamily = fontFamily;
    const align = get("align");
    if (align === "left" || align === "center" || align === "right") style.textAlign = align;
    const background = get("background");
    if (typeof background === "string") style.backgroundColor = background;
    const padding = get("padding");
    if (typeof padding === "number") {
        style.padding = padding;
    } else {
        const fallback = blockPaddingFallback(node.type);
        if (fallback !== undefined) style.padding = fallback;
    }
    const borderWidth = get("borderWidth");
    // Text has no border/radius in this MJML version (illegal on mj-text),
    // so the canvas omits them there to avoid showing unexportable style.
    if (node.type !== "text" && typeof borderWidth === "number" && borderWidth > 0) {
        style.borderWidth = borderWidth;
        style.borderStyle = "solid";
        const borderColor = get("borderColor");
        style.borderColor = typeof borderColor === "string" ? borderColor : "#d1d5db";
    }
    const radius = get("radius");
    if (node.type !== "text" && typeof radius === "number") style.borderRadius = radius;
    return style;
}

function NodeBody({ node }: { readonly node: CanvasNode }) {
    switch (node.type) {
        case "text":
            return (
                <p
                    className="h-full w-full overflow-hidden p-1.5 text-sm leading-relaxed text-foreground"
                    style={blockStyle(node)}
                >
                    {typeof node.props.text === "string" ? node.props.text : "Text"}
                </p>
            );
        case "button":
            return (
                <span
                    className="flex h-full w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                    style={blockStyle(node)}
                >
                    {typeof node.props.text === "string" ? node.props.text : "Button"}
                </span>
            );
        case "divider": {
            const borderColor =
                resolveStyleValue(node.type, node.props, "borderColor") ??
                resolveStyleValue(node.type, node.props, "color");
            const thickness = resolveStyleValue(node.type, node.props, "borderWidth");
            const padding = resolveStyleValue(node.type, node.props, "padding");
            return (
                <div
                    className="flex h-full items-center"
                    style={{
                        padding:
                            typeof padding === "number"
                                ? padding
                                : (blockPaddingFallback(node.type) ?? 0),
                    }}
                >
                    <div
                        className="h-px w-full bg-border"
                        style={
                            borderColor !== undefined || thickness !== undefined
                                ? {
                                      backgroundColor:
                                          typeof borderColor === "string"
                                              ? borderColor
                                              : undefined,
                                      height:
                                          typeof thickness === "number" ? thickness : undefined,
                                  }
                                : undefined
                        }
                    />
                </div>
            );
        }
        case "image": {
            const src = typeof node.props.src === "string" ? node.props.src : "";
            const alt = typeof node.props.alt === "string" ? node.props.alt : "Image";
            if (src === "") {
                return (
                    <div
                        className="flex h-full w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted text-[11px] text-muted-foreground"
                        style={blockStyle(node)}
                    >
                        Image
                    </div>
                );
            }
            return (
                // Plain img: canvas renders arbitrary user-pasted remote URLs
                // that next/image remotePatterns cannot allowlist per host.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    alt={alt}
                    className="h-full w-full rounded-md object-cover"
                    draggable={false}
                    src={src}
                    style={blockStyle(node)}
                />
            );
        }
        case "box":
            return (
                <div
                    className="h-full w-full rounded-md border border-dashed border-border/70 bg-muted/30"
                    style={blockStyle(node)}
                />
            );
        case "spacer":
            return null;
    }
}

export interface SnapMateBox {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

interface SnapGuidesOverlayProps {
    readonly xLines: readonly number[];
    readonly yLines: readonly number[];
    readonly mates: readonly SnapMateBox[];
    readonly rowLabel: string | null;
}

/**
 * Snap guides on both axes + live row-grouping indicator. Pure
 * presentational: CanvasMoveable owns the drag math and passes the active
 * vertical/horizontal snap lines, the row-mate boxes sharing the dragged
 * block's export row, and the row label.
 */
export function SnapGuidesOverlay({ xLines, yLines, mates, rowLabel }: SnapGuidesOverlayProps) {
    if (xLines.length === 0 && yLines.length === 0 && mates.length === 0) return null;
    const [firstY] = yLines;
    return (
        <div
            className="pointer-events-none absolute inset-0 z-40"
            data-testid="snap-guides"
        >
            {xLines.map((line) => (
                <div
                    className="absolute top-0 bottom-0 bg-primary"
                    data-testid="snap-guide-vline"
                    key={`x-${line}`}
                    style={{ left: line - 0.5, width: 1 }}
                />
            ))}
            {yLines.map((line) => (
                <div
                    className="absolute left-0 right-0 bg-primary"
                    data-testid="snap-guide-line"
                    key={`y-${line}`}
                    style={{ top: line - 0.5, height: 1 }}
                />
            ))}
            {rowLabel && firstY !== undefined ? (
                <span
                    className="badge-info absolute left-1 rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide shadow-sm"
                    style={{ top: firstY - 20 }}
                >
                    {rowLabel}
                </span>
            ) : null}
            {mates.map((mate) => (
                <div
                    className="absolute rounded-sm border border-dashed border-primary"
                    data-testid={`snap-row-mate-${mate.id}`}
                    key={mate.id}
                    style={{ left: mate.x, top: mate.y, width: mate.w, height: mate.h }}
                />
            ))}
        </div>
    );
}

/**
 * One absolutely-positioned `.canvas-block` for a canvas node (left/top/w/h from
 * the store, rotation via transform). Renders depth-1 children inside box nodes
 * and the live state badges (ROTATED / OVERLAP / CLIPPED) counter-rotated so
 * they stay readable.
 */
export default function CanvasNodeView({ node, nodes, badgesById }: CanvasNodeViewProps) {
    const selected = useCanvasDoc((state) => state.selection.includes(node.id));
    const selectNodes = useCanvasDoc((state) => state.selectNodes);
    const badges = badgesById[node.id] ?? [];
    const children = Object.values(nodes).filter((child) => child.parentId === node.id);
    const label = layerLabel(node);

    return (
        <div
            aria-label={`${node.type} block: ${label}`}
            className={cn(
                "canvas-block absolute rounded-md border border-border/60 bg-background transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                selected
                    ? "ring-2 ring-primary"
                    : "hover:ring-1 hover:ring-primary/50",
            )}
            data-id={node.id}
            role="button"
            style={{
                left: node.x,
                top: node.y,
                width: node.w,
                height: node.h,
                transform: `rotate(${node.rotation}deg)`,
                zIndex: node.z,
            }}
            tabIndex={0}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    selectNodes([node.id]);
                }
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
