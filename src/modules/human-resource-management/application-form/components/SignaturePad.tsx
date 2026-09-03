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

export interface SignaturePadHandle {
    exportBlob: () => Promise<Blob | null>;
    isEmpty: () => boolean;
}

interface SignaturePadProps {
    typedMode: boolean;
    onTypedModeChange: (typed: boolean) => void;
    typedName: string;
    onTypedNameChange: (name: string) => void;
}

const CANVAS_W = 600;
const CANVAS_H = 180;

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
    function SignaturePad(
        { typedMode, onTypedModeChange, typedName, onTypedNameChange },
        ref
    ) {
        const canvasRef = useRef<HTMLCanvasElement | null>(null);
        const drawingRef = useRef(false);
        const lastRef = useRef<{ x: number; y: number } | null>(null);
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
                e.preventDefault();
                canvasRef.current?.setPointerCapture(e.pointerId);
                drawingRef.current = true;
                lastRef.current = pointFromEvent(e);
            },
            [pointFromEvent]
        );

        const handlePointerMove = useCallback(
            (e: React.PointerEvent<HTMLCanvasElement>) => {
                if (!drawingRef.current) return;
                const canvas = canvasRef.current;
                const ctx = canvas?.getContext("2d");
                if (!canvas || !ctx) return;
                const p = pointFromEvent(e);
                const from = lastRef.current ?? p;
                ctx.strokeStyle = "#111827";
                ctx.lineWidth = 2.5;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
                lastRef.current = p;
                if (!hasStroke) setHasStroke(true);
            },
            [pointFromEvent, hasStroke]
        );

        const endStroke = useCallback(() => {
            drawingRef.current = false;
            lastRef.current = null;
        }, []);

        const clear = useCallback(() => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasStroke(false);
        }, []);

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
            }),
            [typedMode, hasStroke]
        );

        return (
            <div className="space-y-2">
                {typedMode ? (
                    <div className="space-y-1.5">
                        <Label htmlFor="signature-typed-name">Type your full name as your signature</Label>
                        <Input
                            id="signature-typed-name"
                            placeholder="e.g. Juan Dela Cruz"
                            value={typedName}
                            onChange={(e) => onTypedNameChange(e.target.value)}
                            className="max-w-sm font-medium"
                        />
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        <Label>Sign below</Label>
                        <canvas
                            ref={canvasRef}
                            width={CANVAS_W}
                            height={CANVAS_H}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={endStroke}
                            onPointerLeave={endStroke}
                            onPointerCancel={endStroke}
                            className="h-[180px] w-full max-w-md touch-none rounded-md border bg-background"
                        />
                    </div>
                )}

                <div className="flex items-center gap-3">
                    {!typedMode && (
                        <Button type="button" variant="outline" size="sm" onClick={clear}>
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
            </div>
        );
    }
);
