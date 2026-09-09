"use client";

import React, {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
    isStrokeListEmpty,
    paintDot,
    paintStroke,
    paintStrokeSegment,
} from "@/modules/human-resource-management/onboarding/signing/signingStrokes";
import type {
    SigningPoint,
    SigningStroke,
} from "@/modules/human-resource-management/onboarding/signing/signingStrokes";

export interface InkCanvasHandle {
    /** True when the page carries no ink (committed or in-progress). */
    isEmpty: () => boolean;
    /** Clears the bitmap and the stroke model. */
    clear: () => void;
    /** PNG bytes, or null when empty — never a blank-signature blob. */
    exportBlob: () => Promise<Blob | null>;
    /** Strokes for `page`, including an in-progress press if present. */
    getStrokes: () => SigningStroke[];
}

interface InkCanvasProps {
    /** 1-based page number this instance overlays (per-page instances only). */
    page: number;
    /** Controlled stroke model for this page. */
    value: SigningStroke[];
    /** Fires on stroke commit (pointer-up) and on clear — never per-move. */
    onChange: (strokes: SigningStroke[]) => void;
    /** Bitmap width in px (Todo 7 passes the exact 1:1 page size). */
    width?: number;
    /** Bitmap height in px (Todo 7 passes the exact 1:1 page size). */
    height?: number;
    /** Live stroke width in bitmap px. */
    strokeWidth?: number;
    /** Live stroke color (bitmap ink stays dark; display inversion is CSS-only). */
    strokeColor?: string;
    disabled?: boolean;
    showClear?: boolean;
    className?: string;
    ariaLabel?: string;
    /**
     * Overlay mode for the Todo 7 signing surface: transparent, borderless
     * wrapper so the template HTML beneath stays visible (exact 1:1
     * alignment). Default false preserves the standalone boxed look.
     */
    transparent?: boolean;
}

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const DEFAULT_STROKE_WIDTH = 2.5;
const DEFAULT_STROKE_COLOR = "#111827";

function cloneStrokes(strokes: SigningStroke[]): SigningStroke[] {
    return strokes.map((stroke) => ({
        points: stroke.points.map((point) => ({ x: point.x, y: point.y })),
        width: stroke.width,
        color: stroke.color,
    }));
}

export const InkCanvas = forwardRef<InkCanvasHandle, InkCanvasProps>(function InkCanvas(
    {
        page,
        value,
        onChange,
        width = DEFAULT_WIDTH,
        height = DEFAULT_HEIGHT,
        strokeWidth = DEFAULT_STROKE_WIDTH,
        strokeColor = DEFAULT_STROKE_COLOR,
        disabled = false,
        showClear = true,
        className,
        ariaLabel,
        transparent = false,
    },
    ref
) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const currentRef = useRef<SigningStroke | null>(null);
    const lastRef = useRef<SigningPoint | null>(null);
    const committedRef = useRef<SigningStroke[]>(value);
    const dimsRef = useRef<string>("");
    const [hasInk, setHasInk] = useState(() => !isStrokeListEmpty(value));

    const pointFromClient = useCallback(
        (clientX: number, clientY: number, rect: DOMRect): SigningPoint => ({
            x: ((clientX - rect.left) / rect.width) * width,
            y: ((clientY - rect.top) / rect.height) * height,
        }),
        [width, height]
    );

    // External model changes (draft load, clear from parent, bitmap-size
    // change) replay through the shared paint path at 1x — identical pixels.
    useEffect(() => {
        if (value === committedRef.current && dimsRef.current === `${width}x${height}`) return;
        committedRef.current = value;
        dimsRef.current = `${width}x${height}`;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const stroke of value) paintStroke(ctx, stroke);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- canvas bitmap is an external system (same justification as PhotoCapture blob URLs); hasInk mirrors the painted bitmap so the Clear gate matches what is on screen
        setHasInk(!isStrokeListEmpty(value));
    }, [value, width, height]);

    const commitStroke = useCallback(
        (stroke: SigningStroke) => {
            const next = [...committedRef.current, stroke];
            committedRef.current = next;
            onChange(next);
            setHasInk(true);
        },
        [onChange]
    );

    const handlePointerDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (disabled || drawingRef.current) return;
            e.preventDefault();
            canvasRef.current?.setPointerCapture(e.pointerId);
            const canvas = canvasRef.current;
            if (!canvas) return;
            const start = pointFromClient(
                e.clientX,
                e.clientY,
                canvas.getBoundingClientRect()
            );
            drawingRef.current = true;
            currentRef.current = { points: [start], width: strokeWidth, color: strokeColor };
            lastRef.current = start;
        },
        [disabled, pointFromClient, strokeWidth, strokeColor]
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (disabled || !drawingRef.current) return;
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            const current = currentRef.current;
            if (!canvas || !ctx || !current) return;
            const rect = canvas.getBoundingClientRect();
            const nativeEvent = e.nativeEvent;
            const coalesced =
                typeof nativeEvent.getCoalescedEvents === "function"
                    ? nativeEvent.getCoalescedEvents()
                    : [nativeEvent];
            for (const coalescedEvent of coalesced) {
                const point = pointFromClient(
                    (coalescedEvent as PointerEvent).clientX,
                    (coalescedEvent as PointerEvent).clientY,
                    rect
                );
                const from = lastRef.current ?? point;
                // Same segment painter the replay path uses (1x fidelity).
                paintStrokeSegment(ctx, from, point, current.width, current.color);
                current.points.push(point);
                lastRef.current = point;
            }
            if (!hasInk) setHasInk(true);
        },
        [disabled, pointFromClient, hasInk]
    );

    const endStroke = useCallback(() => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        const current = currentRef.current;
        currentRef.current = null;
        lastRef.current = null;
        if (!current || current.points.length === 0) return;
        // Tap without movement still counts as ink (filled dot).
        if (current.points.length === 1) {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            const only = current.points[0];
            if (canvas && ctx && only) paintDot(ctx, only, current.width, current.color);
        }
        commitStroke(current);
    }, [commitStroke]);

    const clear = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        committedRef.current = [];
        currentRef.current = null;
        lastRef.current = null;
        drawingRef.current = false;
        setHasInk(false);
        onChange([]);
    }, [onChange]);

    useImperativeHandle(
        ref,
        () => ({
            isEmpty: () => {
                const inProgress = currentRef.current;
                const inProgressEmpty =
                    !inProgress ||
                    !Array.isArray(inProgress.points) ||
                    inProgress.points.length === 0;
                return isStrokeListEmpty(committedRef.current) && inProgressEmpty;
            },
            clear,
            exportBlob: () =>
                new Promise<Blob | null>((resolve) => {
                    const canvas = canvasRef.current;
                    if (!canvas || isStrokeListEmpty(committedRef.current)) {
                        resolve(null);
                        return;
                    }
                    canvas.toBlob((blob) => resolve(blob), "image/png");
                }),
            getStrokes: () => {
                const inProgress = currentRef.current;
                const committed = cloneStrokes(committedRef.current);
                if (
                    inProgress &&
                    Array.isArray(inProgress.points) &&
                    inProgress.points.length > 0
                ) {
                    committed.push({
                        points: inProgress.points.map((point) => ({ x: point.x, y: point.y })),
                        width: inProgress.width,
                        color: inProgress.color,
                    });
                }
                return committed;
            },
        }),
        [clear]
    );

    return (
        <div className={className ?? "space-y-2"}>
            {/* overflow-hidden wrapper caps the canvas per QA §2 (1280px + 375px). */}
            <div className={transparent ? "h-full w-full overflow-hidden" : "w-full overflow-hidden rounded-md border bg-background"}>
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endStroke}
                    onPointerLeave={endStroke}
                    onPointerCancel={endStroke}
                    aria-label={ariaLabel ?? `Ink canvas for page ${page}`}
                    style={{ aspectRatio: `${width} / ${height}` }}
                    className="block w-full touch-none dark:invert"
                />
            </div>
            {showClear && (
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clear}
                        disabled={disabled || !hasInk}
                        aria-label={`Clear ink on page ${page}`}
                    >
                        Clear
                    </Button>
                </div>
            )}
        </div>
    );
});
