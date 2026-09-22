"use client";

import { useRef } from "react";
import { flushSync } from "react-dom";
import Moveable from "react-moveable";
import Selecto from "react-selecto";

import { useCanvasDoc } from "../hooks/useCanvasDoc";

interface CanvasMoveableProps {
    readonly stageEl: HTMLDivElement | null;
    readonly targetId: string | null;
    readonly width: number;
}

/**
 * Moveable + Selecto wrappers for the live canvas (v0.56 cheat-sheet wiring).
 * - Moveable binds to the FIRST selected node; every gesture frame is coalesced
 *   by the store (beginGesture → move/resize/rotate → endGesture).
 * - Selecto marquee multi-selects `.canvas-block` targets; shift unions.
 * Loaded client-only via dynamic(..., { ssr: false }) from StageCanvas.
 */
export default function CanvasMoveable({ stageEl, targetId, width }: CanvasMoveableProps) {
    const beginGesture = useCanvasDoc((state) => state.beginGesture);
    const endGesture = useCanvasDoc((state) => state.endGesture);
    const moveNode = useCanvasDoc((state) => state.moveNode);
    const resizeNode = useCanvasDoc((state) => state.resizeNode);
    const rotateNode = useCanvasDoc((state) => state.rotateNode);
    const selectNodes = useCanvasDoc((state) => state.selectNodes);
    const selectoRef = useRef<Selecto>(null);

    if (!stageEl) return null;

    return (
        <>
            <Selecto
                container={stageEl}
                hitRate={0}
                onDragEnd={(event) => {
                    // OnDragEnd carries NO `selected` (selecto types: rect+isSelect
                    // only); the live selection must be read from the instance via
                    // getSelectedTargets() — the previously used getSelected() does
                    // not exist, so ids always came back empty and click-select /
                    // reselect never reached the store.
                    const eventSelected = (
                        event as unknown as { selected?: readonly HTMLElement[] }
                    ).selected;
                    const elements =
                        eventSelected ?? selectoRef.current?.getSelectedTargets() ?? [];
                    const ids = elements
                        .map((element) => element.dataset?.id)
                        .filter((id): id is string => Boolean(id));
                    // Empty non-shift results come from dragging off a block (or
                    // Moveable chrome); background deselect is the stage's
                    // pointerdown job, so never let these wipe the selection
                    // Moveable is bound to.
                    if (ids.length === 0 && !event.inputEvent.shiftKey) return;
                    const current = useCanvasDoc.getState().selection;
                    selectNodes(
                        event.inputEvent.shiftKey
                            ? Array.from(new Set([...current, ...ids]))
                            : ids,
                    );
                }}
                onDragStart={(event) => {
                    event.inputEvent.preventDefault();
                }}
                dragCondition={(event) => {
                    // Gestures that begin on the selected block or Moveable's own
                    // chrome belong to Moveable: letting Selecto run them would
                    // marquee-select every block the drag path crosses and commit
                    // that union on dragEnd. Veto at dragCondition — the one gate
                    // selecto evaluates before emit/isTrusted branching.
                    const target = event.inputEvent?.target as HTMLElement | null | undefined;
                    if (!target) return true;
                    if (target.closest("[class*='moveable-']")) return false;
                    const block = target.closest<HTMLElement>(".canvas-block");
                    const selectedId = useCanvasDoc.getState().selection[0];
                    if (block && selectedId && block.dataset.id === selectedId) return false;
                    return true;
                }}
                ref={selectoRef}
                selectableTargets={[".canvas-block"]}
                selectByClick
                toggleContinueSelect={["shift"]}
            />
            {targetId ? (
                <Moveable
                    bounds={{ left: 0, top: 0, right: width, bottom: 2000 }}
                    container={stageEl}
                    draggable
                    flushSync={flushSync}
                    onDrag={(event) =>
                        moveNode(targetId, Math.round(event.left), Math.round(event.top))
                    }
                    onDragEnd={() => endGesture()}
                    onDragStart={() => beginGesture()}
                    onResize={(event) =>
                        resizeNode(targetId, Math.round(event.width), Math.round(event.height))
                    }
                    onResizeEnd={() => endGesture()}
                    onResizeStart={() => beginGesture()}
                    onRotate={(event) => rotateNode(targetId, Math.round(event.rotation))}
                    onRotateEnd={() => endGesture()}
                    onRotateStart={() => beginGesture()}
                    origin={false}
                    resizable
                    rotatable
                    snappable={true}
                    target={`[data-id="${targetId}"]`}
                />
            ) : null}
        </>
    );
}
