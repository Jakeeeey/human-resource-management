"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface PhotoCaptureProps {
    value: File | null;
    onChange: (file: File | null) => void;
}

/** The paper form's 2x2 ID photo box. Optional -- a cameraless PC can't
 * produce one live (architecture sec 4 item 15), so this never blocks submit. */
export function PhotoCapture({ value, onChange }: PhotoCaptureProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    // Derived, not state -- avoids a setState-in-effect; the effect below only
    // ever does cleanup (revoking the previous blob URL).
    const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

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
