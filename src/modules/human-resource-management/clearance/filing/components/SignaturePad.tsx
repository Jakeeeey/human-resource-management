"use client";

import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { paintDot, paintStrokeSegment } from "../utils/signingStrokes";
import type { SigningPoint, SigningStroke } from "../utils/signingStrokes";

export interface ClearanceSignaturePadHandle {
    exportBlob: () => Promise<Blob | null>;
    isEmpty: () => boolean;
    exportStrokes: () => SigningStroke[];
    clear: () => void;
}

interface ClearanceSignaturePadProps {
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

export const SignaturePad = forwardRef<ClearanceSignaturePadHandle, ClearanceSignaturePadProps>(
    function SignaturePad(
        { onStrokesChange, strokeWidth = DEFAULT_STROKE_WIDTH, strokeColor = DEFAULT_STROKE_COLOR },
        ref
    ): JSX.Element {
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
                if (drawingRef.current) return;
                e.preventDefault();
                canvasRef.current?.setPointerCapture(e.pointerId);
                const start = pointFromEvent(e);
                drawingRef.current = true;
                currentRef.current = { points: [start], width: strokeWidth, color: strokeColor };
                lastRef.current = start;
            },
            [pointFromEvent, strokeWidth, strokeColor]
        );

        const handlePointerMove = useCallback(
            (e: React.PointerEvent<HTMLCanvasElement>) => {
                if (!drawingRef.current) return;
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
                    paintStrokeSegment(ctx, from, point, current.width, current.color);
                    current.points.push(point);
                    lastRef.current = point;
                }
                if (!hasStroke) setHasStroke(true);
            },
            [hasStroke]
        );

        const endStroke = useCallback(() => {
            if (!drawingRef.current) return;
            drawingRef.current = false;
            const current = currentRef.current;
            currentRef.current = null;
            lastRef.current = null;
            if (!current || current.points.length === 0) return;
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
                isEmpty: () => !hasStroke,
                exportBlob: () =>
                    new Promise<Blob | null>((resolve) => {
                        if (!hasStroke || !canvasRef.current) {
                            resolve(null);
                            return;
                        }
                        canvasRef.current.toBlob((blob) => resolve(blob), "image/png");
                    }),
                exportStrokes: () => cloneStrokes(strokesRef.current),
                clear,
            }),
            [hasStroke, clear]
        );

        return (
            <div className="space-y-2">
                <div className="space-y-1.5">
                    <Label>Sign below</Label>
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
                            aria-label="Clearance signature pad"
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
                <div className="flex items-center gap-3">
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
                </div>
                {!hasStroke && (
                    <p
                        className="max-w-md truncate text-xs text-muted-foreground"
                        title="Draw the signature above — an empty pad cannot be saved"
                    >
                        Draw the signature above — an empty pad cannot be saved.
                    </p>
                )}
            </div>
        );
    }
);
