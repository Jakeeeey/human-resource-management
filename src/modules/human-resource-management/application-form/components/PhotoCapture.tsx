"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface PhotoCaptureProps {
    value: File | null;
    onChange: (file: File | null) => void;
}

/** Square edge, in px, of the exported 2x2 capture. */
const PHOTO_EDGE = 512;

export function PhotoCapture({ value, onChange }: PhotoCaptureProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Object URL is created inside the effect (not useMemo): the URL created
    // in one effect run is revoked only by that same run's cleanup, so a
    // remount or a rapid value swap can never revoke the URL on screen.
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isStreamReady, setIsStreamReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);

    useEffect(() => {
        const url = value ? URL.createObjectURL(value) : null;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- object URLs live in the browser URL registry (external system); recreating per value keeps remounts from showing a revoked URL
        setPreviewUrl(url);
        if (!url) return;
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [value]);

    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setIsStreamReady(false);
    }, []);

    // Release the camera on unmount (section collapse, navigation, unmount) so
    // the device indicator never stays lit after the field is gone.
    useEffect(() => () => stopStream(), [stopStream]);

    // Attach the live stream when the preview <video> mounts inside the camera
    // dialog. A callback ref is used rather than an effect because the dialog
    // renders through a portal, so the node only exists once React hands it over.
    const attachVideo = useCallback((node: HTMLVideoElement | null) => {
        videoRef.current = node;
        if (!node) return;
        const stream = streamRef.current;
        if (!stream) return;
        node.srcObject = stream;
        void node.play().catch(() => {
            /* autoplay can be rejected; the preview simply stays paused */
        });
    }, []);

    const openCamera = useCallback(async () => {
        setCameraError(null);
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            setCameraError(
                "Camera access needs a secure connection (HTTPS or localhost). Open the app that way, then allow the camera permission prompt.",
            );
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: "environment" } },
                audio: false,
            });
            streamRef.current = stream;
            setIsCameraOpen(true);
        } catch (error) {
            setCameraError(
                error instanceof DOMException && error.name === "NotAllowedError"
                    ? "Camera access was denied. Allow it in your browser, or upload a photo instead."
                    : "No camera is available on this device. Upload a photo instead.",
            );
        }
    }, []);

    const closeCamera = useCallback(() => {
        setIsCameraOpen(false);
        stopStream();
    }, [stopStream]);

    const capture = useCallback(() => {
        const video = videoRef.current;
        if (!video || !video.videoWidth || !video.videoHeight) return;

        // Centre-crop the frame to a square, then resize to PHOTO_EDGE so the
        // stored photo satisfies the 2x2 requirement for every camera aspect.
        const edge = Math.min(video.videoWidth, video.videoHeight);
        const sourceX = (video.videoWidth - edge) / 2;
        const sourceY = (video.videoHeight - edge) / 2;

        const canvas = document.createElement("canvas");
        canvas.width = PHOTO_EDGE;
        canvas.height = PHOTO_EDGE;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(video, sourceX, sourceY, edge, edge, 0, 0, PHOTO_EDGE, PHOTO_EDGE);

        canvas.toBlob(
            (blob) => {
                if (!blob) return;
                onChange(new File([blob], "photo-2x2.jpg", { type: "image/jpeg" }));
                closeCamera();
            },
            "image/jpeg",
            0.92,
        );
    }, [closeCamera, onChange]);

    return (
        <div className="space-y-1.5">
            <Label>2x2 Photo (optional)</Label>
            <div className="flex items-start gap-3">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a served asset
                        <img src={previewUrl} alt="Applicant photo preview" className="h-full w-full object-cover" />
                    ) : (
                        <span className="px-2 text-center text-xs text-muted-foreground">No photo</span>
                    )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-w-[9rem]"
                        onClick={() => void openCamera()}
                    >
                        <Camera className="mr-1 h-3.5 w-3.5" />
                        {value ? "Retake Photo" : "Take Photo"}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-w-[9rem]"
                        onClick={() => inputRef.current?.click()}
                    >
                        <Upload className="mr-1 h-3.5 w-3.5" />
                        {value ? "Replace Upload" : "Upload Photo"}
                    </Button>
                    {value && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-w-[9rem]"
                            onClick={() => {
                                onChange(null);
                                if (inputRef.current) inputRef.current.value = "";
                            }}
                        >
                            <X className="mr-1 h-3 w-3" />
                            Remove
                        </Button>
                    )}
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
                    />
                    {cameraError && <p className="text-xs text-destructive">{cameraError}</p>}
                </div>
            </div>

            <Dialog
                open={isCameraOpen}
                onOpenChange={(open) => {
                    if (!open) closeCamera();
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Take Photo</DialogTitle>
                        <DialogDescription>Center your face inside the square, then capture.</DialogDescription>
                    </DialogHeader>
                    <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-xl bg-black">
                        <video
                            ref={attachVideo}
                            className="h-full w-full object-cover"
                            playsInline
                            muted
                            aria-label="Live camera preview"
                            onLoadedMetadata={() => setIsStreamReady(true)}
                        />
                        <span
                            className="pointer-events-none absolute inset-3 rounded-lg border border-white/25"
                            aria-hidden="true"
                        />
                        <span
                            className="pointer-events-none absolute left-3 top-3 h-7 w-7 rounded-tl-lg border-l-2 border-t-2 border-white"
                            aria-hidden="true"
                        />
                        <span
                            className="pointer-events-none absolute right-3 top-3 h-7 w-7 rounded-tr-lg border-r-2 border-t-2 border-white"
                            aria-hidden="true"
                        />
                        <span
                            className="pointer-events-none absolute bottom-3 left-3 h-7 w-7 rounded-bl-lg border-b-2 border-l-2 border-white"
                            aria-hidden="true"
                        />
                        <span
                            className="pointer-events-none absolute bottom-3 right-3 h-7 w-7 rounded-br-lg border-b-2 border-r-2 border-white"
                            aria-hidden="true"
                        />
                    </div>
                    <div className="flex justify-center gap-2">
                        <Button type="button" onClick={capture} disabled={!isStreamReady}>
                            Capture
                        </Button>
                        <Button type="button" variant="outline" onClick={closeCamera}>
                            Cancel
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
