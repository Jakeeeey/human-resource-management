"use client";

import React, {
    forwardRef,
    useCallback,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    paintDot,
    paintStrokeSegment,
} from "@/modules/human-resource-management/onboarding/signing/signingStrokes";
import type {
    SigningPoint,
    SigningStroke,
} from "@/modules/human-resource-management/onboarding/signing/signingStrokes";

/**
 * Module-local port of the `application-form` SignaturePad pattern
 * (ported, never imported — module boundary). Contract preserved:
 * canvas `exportBlob` PNG + typed-mode-returns-null, plus stroke-JSON
 * export (`exportStrokes`) for the Todo 7 stamp + envelope artifacts.
 */

export interface OnboardingSignaturePadHandle {
    /** PNG bytes, or null in typed mode / when empty — never a blank blob. */
    exportBlob: () => Promise<Blob | null>;
    /**
     * True while typed mode is on OR no ink is committed (typed-mode-returns-
     * null preserved from the source pattern: a typed name is not ink).
     */
    isEmpty: () => boolean;
    /** Committed strokes in bitmap space; [] in typed mode. */
    exportStrokes: () => SigningStroke[];
    /** Clears the bitmap and the stroke model. */
    clear: () => void;
}

interface OnboardingSignaturePadProps {
    typedMode: boolean;
    onTypedModeChange: (typed: boolean) => void;
    typedName: string;
    onTypedNameChange: (name: string) => void;
    /** Fires on stroke commit (pointer-up) and on clear — never per-move. */
    onStrokesChange?: (strokes: SigningStroke[]) => void;
    strokeWidth?: number;
    strokeColor?: string;
}

const CANVAS_W = 600;
const CANVAS_H = 180;
const DEFAULT_STROKE_WIDTH = 2.5;
const DEFAULT_STROKE_COLOR = "#111827";

function cloneStrokes(strokes: SigningStroke[]): SigningStroke[] {
    return strokes.map((stroke) => ({
        points: stroke.points.map((point) => ({ x: point.x, y: point.y })),
        width: stroke.width,
        color: stroke.color,
    }));
}

export const SignaturePad = forwardRef<
    OnboardingSignaturePadHandle,
    OnboardingSignaturePadProps
>(function SignaturePad(
    {
        typedMode,
        onTypedModeChange,
        typedName,
        onTypedNameChange,
        onStrokesChange,
        strokeWidth = DEFAULT_STROKE_WIDTH,
        strokeColor = DEFAULT_STROKE_COLOR,
    },
    ref
) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const currentRef = useRef<SigningStroke | null>(null);
    const lastRef = useRef<SigningPoint | null>(null);
    const strokesRef = useRef<SigningStroke[]>([]);
    const [hasStroke, setHasStroke] = useState(false);

    const pointFromEvent = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
            y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
        };
    }, []);

    const handlePointerDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (typedMode || drawingRef.current) return;
            e.preventDefault();
            canvasRef.current?.setPointerCapture(e.pointerId);
            const start = pointFromEvent(e);
            drawingRef.current = true;
            currentRef.current = { points: [start], width: strokeWidth, color: strokeColor };
            lastRef.current = start;
        },
        [typedMode, pointFromEvent, strokeWidth, strokeColor]
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (typedMode || !drawingRef.current) return;
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
                const point = {
                    x:
                        (((coalescedEvent as PointerEvent).clientX - rect.left) / rect.width) *
                        CANVAS_W,
                    y:
                        (((coalescedEvent as PointerEvent).clientY - rect.top) / rect.height) *
                        CANVAS_H,
                };
                const from = lastRef.current ?? point;
                // Same segment painter the replay path uses (1x fidelity).
                paintStrokeSegment(ctx, from, point, current.width, current.color);
                current.points.push(point);
                lastRef.current = point;
            }
            if (!hasStroke) setHasStroke(true);
        },
        [typedMode, hasStroke]
    );

    const endStroke = useCallback(() => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        const current = currentRef.current;
        currentRef.current = null;
        lastRef.current = null;
        if (!current || current.points.length === 0) return;
        // Tap without movement counts as ink (filled dot) so a deliberate
        // single mark is never mistaken for an empty pad.
        if (current.points.length === 1) {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            const only = current.points[0];
            if (canvas && ctx && only) paintDot(ctx, only, current.width, current.color);
        }
        strokesRef.current = [...strokesRef.current, current];
        setHasStroke(true);
        onStrokesChange?.(cloneStrokes(strokesRef.current));
    }, [onStrokesChange]);

    const clear = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        strokesRef.current = [];
        currentRef.current = null;
        lastRef.current = null;
        drawingRef.current = false;
        setHasStroke(false);
        onStrokesChange?.([]);
    }, [onStrokesChange]);

    useImperativeHandle(
        ref,
        () => ({
            isEmpty: () => typedMode || !hasStroke,
            exportBlob: () =>
                new Promise<Blob | null>((resolve) => {
                    if (typedMode || !hasStroke || !canvasRef.current) {
                        resolve(null);
                        return;
                    }
                    canvasRef.current.toBlob((blob) => resolve(blob), "image/png");
                }),
            exportStrokes: () => (typedMode ? [] : cloneStrokes(strokesRef.current)),
            clear,
        }),
        [typedMode, hasStroke, clear]
    );

    return (
        <div className="space-y-2">
            {typedMode ? (
                <div className="space-y-1.5">
                    <Label htmlFor="onboarding-signature-typed-name">
                        Type your full name as your signature
                    </Label>
                    <Input
                        id="onboarding-signature-typed-name"
                        placeholder="e.g. Juan Dela Cruz"
                        value={typedName}
                        onChange={(e) => onTypedNameChange(e.target.value)}
                        className="max-w-sm font-medium"
                    />
                    <p className="max-w-sm text-xs text-muted-foreground">
                        Typed names cannot become a signature stamp — switch to
                        Draw instead and sign in the pad below.
                    </p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    <Label>Sign below</Label>
                    {/* overflow-hidden wrapper caps the canvas per QA §2. */}
                    <div className="relative w-full max-w-md overflow-hidden rounded-md border bg-background">
                        <canvas
                            ref={canvasRef}
                            width={CANVAS_W}
                            height={CANVAS_H}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={endStroke}
                            onPointerLeave={endStroke}
                            onPointerCancel={endStroke}
                            aria-label="Onboarding signature pad"
                            className="block h-[180px] w-full touch-none dark:invert"
                        />
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-x-8 bottom-[22%] border-t border-dashed border-muted-foreground/40"
                        />
                        <span className="pointer-events-none absolute bottom-[23%] left-8 text-[10px] text-muted-foreground/70">
                            Sign above the line
                        </span>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-3">
                {!typedMode && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clear}
                        disabled={!hasStroke}
                        aria-label="Clear signature"
                    >
                        Clear
                    </Button>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onTypedModeChange(!typedMode)}
                >
                    {typedMode ? "Draw instead" : "Type instead"}
                </Button>
            </div>
            {!typedMode && !hasStroke && (
                <p className="max-w-md truncate text-xs text-muted-foreground" title="Draw your signature above — an empty pad cannot be filed">
                    Draw your signature above — an empty pad cannot be filed.
                </p>
            )}
        </div>
    );
});
