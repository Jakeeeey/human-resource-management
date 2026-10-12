"use client";

import { cn } from "@/lib/utils";
import { ID_CARD } from "../types/id-layout.schema";
import type { IdNode } from "../types/id-layout.schema";
import { IdNodeBody, idNodeText } from "./IdCardNode";
import { IdInlineEditor } from "./IdInlineEditor";
import { sanitizeIdInlineHtml } from "./sanitize";
import type { IdDocStore } from "./store";

export interface IdNodeViewProps {
    readonly node: IdNode;
    readonly store: IdDocStore;
    readonly values?: Readonly<Record<string, string>>;
}

interface IdSnapGuidesOverlayProps {
    readonly xLines: readonly number[];
    readonly yLines: readonly number[];
}

export function IdSnapGuidesOverlay({ xLines, yLines }: IdSnapGuidesOverlayProps) {
    if (xLines.length === 0 && yLines.length === 0) return null;
    return (
        <div className="pointer-events-none absolute inset-0 z-40" data-testid="id-snap-guides">
            {xLines.map((line) => (
                <div
                    className="absolute top-0 bottom-0 bg-primary"
                    data-testid="id-snap-guide-vline"
                    key={`x-${line}`}
                    style={{ left: line - 0.5, width: 1 }}
                />
            ))}
            {yLines.map((line) => (
                <div
                    className="absolute left-0 right-0 bg-primary"
                    data-testid="id-snap-guide-line"
                    key={`y-${line}`}
                    style={{ top: line - 0.5, height: 1 }}
                />
            ))}
        </div>
    );
}

function idNodeLabel(node: IdNode): string {
    if (node.type === "variable") return "Variable";
    const text = idNodeText(node).replace(/<[^>]*>/g, "").trim().slice(0, 28);
    if (text.length > 0) return text;
    return node.type.charAt(0).toUpperCase() + node.type.slice(1);
}

export function IdNodeView({ node, store }: IdNodeViewProps) {
    const selected = store((state) => state.selection.includes(node.id));
    const selectNodes = store((state) => state.selectNodes);
    const editingId = store((state) => state.editingId);
    const setEditingId = store((state) => state.setEditingId);
    const updateProps = store((state) => state.updateProps);
    const beginGesture = store((state) => state.beginGesture);
    const endGesture = store((state) => state.endGesture);
    const label = idNodeLabel(node);

    if (node.type === "text" && editingId === node.id) {
        const flipBelow = node.y < 44;
        const shiftLeft = Math.max(-node.x, Math.min(0, ID_CARD.width - node.x - 260));
        return (
            <div
                aria-label={`${node.type} block: ${label}`}
                className="id-block absolute overflow-hidden"
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
                <div
                    className="relative h-full w-full"
                    data-id-editing=""
                    onClick={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <IdInlineEditor
                        autoFocus
                        flipBelow={flipBelow}
                        initialHtml={idNodeText(node)}
                        key={node.id}
                        nodeId={node.id}
                        shiftLeft={shiftLeft}
                        onBeginGesture={beginGesture}
                        onCommit={(clean) => {
                            const current = store.getState().nodes[node.id];
                            const currentText = current ? sanitizeIdInlineHtml(idNodeText(current)) : "";
                            if (clean !== currentText) updateProps(node.id, { text: clean });
                        }}
                        onEndGesture={endGesture}
                        onReadText={() => {
                            const current = store.getState().nodes[node.id];
                            return current ? idNodeText(current) : "";
                        }}
                        onRedo={() => store.getState().redo()}
                        onRequestClose={() => setEditingId(null)}
                        onUndo={() => store.getState().undo()}
                    />
                </div>
            </div>
        );
    }

    const stored = node.type === "text" ? idNodeText(node) : "";
    const showPlaceholder = node.type === "text" && sanitizeIdInlineHtml(stored) === "";
    const enterEdit = (): void => {
        if (node.type !== "text" || node.locked) return;
        const current = store.getState();
        current.endGesture();
        current.setEditingId(node.id);
    };

    return (
        <div
            aria-label={`${node.type} block: ${label}`}
            className={cn(
                "id-block absolute overflow-hidden transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                selected ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/50",
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
                opacity: node.opacity,
            }}
            tabIndex={0}
            {...(node.locked ? { "data-locked": "" } : {})}
            onDoubleClick={() => enterEdit()}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    if (node.locked) return;
                    selectNodes([node.id]);
                }
            }}
        >
            {showPlaceholder ? (
                <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground" onDoubleClick={enterEdit}>
                    Text
                </div>
            ) : (
                <div className="h-full w-full" onDoubleClick={enterEdit}>
                    <IdNodeBody node={node} />
                </div>
            )}
        </div>
    );
}
