"use client";

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface PhotoCaptureProps {
    value: File | null;
    onChange: (file: File | null) => void;
}

export function PhotoCapture({ value, onChange }: PhotoCaptureProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    // Object URL is created inside the effect (not useMemo): the URL created
    // in one effect run is revoked only by that same run's cleanup, so a
    // remount or a rapid value swap can never revoke the URL on screen.
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        const url = value ? URL.createObjectURL(value) : null;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- object URLs live in the browser URL registry (external system); recreating per value keeps remounts from showing a revoked URL
        setPreviewUrl(url);
        if (!url) return;
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [value]);

    return (
        <div className="space-y-1.5">
            <Label>2x2 Photo (optional)</Label>
            <div className="flex items-center gap-3">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a served asset
                        <img src={previewUrl} alt="Applicant photo preview" className="h-full w-full object-cover" />
                    ) : (
                        <span className="px-2 text-center text-xs text-muted-foreground">No photo</span>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                        {value ? "Retake / Replace" : "Take / Upload Photo"}
                    </Button>
                    {value && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                onChange(null);
                                if (inputRef.current) inputRef.current.value = "";
                            }}
                        >
                            <X className="mr-1 h-3 w-3" />
                            Remove
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
