"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Loader2,
    Download,
    FileWarning,
    Paperclip,
} from "lucide-react";

export interface ApplicationAttachmentFile {
    type: string;
    label: string;
    filename: string;
    file_url: string | null;
}

interface AttachmentPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    file: ApplicationAttachmentFile | null;
}

function previewKind(fileName: string, url: string | null) {
    const dataMime = url?.startsWith("data:")
        ? url.slice(5, url.indexOf(";")).toLowerCase()
        : "";
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

    if (dataMime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"].includes(ext)) {
        return "image" as const;
    }
    if (dataMime.startsWith("video/") || ["mp4", "webm", "ogv"].includes(ext)) {
        return "video" as const;
    }
    if (dataMime === "application/pdf" || ext === "pdf") {
        return "pdf" as const;
    }
    if (
        dataMime.startsWith("text/") ||
        dataMime === "application/json" ||
        ["txt", "md", "markdown", "json", "csv", "log", "html", "htm", "xml"].includes(ext)
    ) {
        return "text" as const;
    }
    return "none" as const;
}

export function AttachmentPreviewDialog({
    open,
    onOpenChange,
    file,
}: AttachmentPreviewDialogProps) {
    const kind = useMemo(
        () => (file ? previewKind(file.filename, file.file_url) : "none"),
        [file]
    );
    const [textContent, setTextContent] = useState<string | null>(null);
    const [textError, setTextError] = useState<string | null>(null);

    const viewUrl = file?.file_url ?? null;

    useEffect(() => {
        if (!open || !file || !viewUrl || kind !== "text") {
            return;
        }
        let cancelled = false;
        fetch(viewUrl)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to load preview");
                const text = await res.text();
                if (!cancelled) {
                    setTextContent(text);
                    setTextError(null);
                }
            })
            .catch((err: Error) => {
                if (!cancelled) {
                    setTextError(err.message);
                    setTextContent(null);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [open, file, viewUrl, kind]);

    if (!file) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="w-[95vw] sm:max-w-[900px] max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-2 shadow-2xl"
            >
                <div className="bg-gradient-to-r from-primary/10 via-background to-primary/5 p-5 pb-3">
                    <DialogHeader>
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
                                <Paperclip className="h-5 w-5 text-primary stroke-[2.5px]" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <DialogTitle className="text-lg font-bold tracking-tight line-clamp-1">
                                    {file.filename}
                                </DialogTitle>
                                <DialogDescription className="text-xs font-medium opacity-70">
                                    {file.type}{file.label ? ` — ${file.label}` : ""}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <Separator className="bg-primary/10" />

                <div className="p-5">
                    <div className="rounded-xl border bg-muted/20 overflow-hidden">
                        {kind === "image" && viewUrl && (
                            <div className="flex items-center justify-center bg-zinc-950/5 p-4 max-h-[60vh]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={viewUrl}
                                    alt={file.filename}
                                    className="max-w-full max-h-[56vh] object-contain rounded-lg shadow-sm"
                                />
                            </div>
                        )}

                        {kind === "video" && viewUrl && (
                            <div className="flex items-center justify-center bg-black p-4 max-h-[60vh]">
                                <video
                                    src={viewUrl}
                                    controls
                                    className="max-w-full max-h-[56vh] rounded-lg"
                                >
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        )}

                        {kind === "pdf" && viewUrl && (
                            <div className="h-[60vh] overflow-auto bg-zinc-100">
                                <iframe
                                    src={viewUrl}
                                    title={file.filename}
                                    className="w-full h-full border-0"
                                />
                            </div>
                        )}

                        {kind === "text" && (
                            <div className="h-[60vh] overflow-auto">
                                {textError ? (
                                    <PreviewUnavailable message={textError} />
                                ) : textContent === null ? (
                                    <div className="flex items-center justify-center h-full gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading preview...
                                    </div>
                                ) : (
                                    <pre className="text-xs font-mono whitespace-pre-wrap break-words p-4 text-foreground/90">
                                        {textContent}
                                    </pre>
                                )}
                            </div>
                        )}

                        {kind === "none" && (
                            <PreviewUnavailable />
                        )}
                    </div>
                </div>

                <div className="px-5 pb-5 pt-0">
                    <DialogFooter className="flex w-full sm:justify-end gap-3 items-center">
                        {viewUrl && (
                            <Button type="button" asChild className="rounded-full px-6">
                                <a href={viewUrl} download={file.filename}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download
                                </a>
                            </Button>
                        )}
                        <DialogClose asChild>
                            <Button type="button" variant="outline" className="rounded-full px-6">
                                Close
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function PreviewUnavailable({ message }: { message?: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
            <div className="p-3 rounded-full bg-amber-500/10">
                <FileWarning className="h-6 w-6 text-amber-600" />
            </div>
            <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                    No preview available
                </p>
                {message ? (
                    <p className="text-xs text-muted-foreground/70 max-w-sm">{message}</p>
                ) : (
                    <p className="text-xs text-muted-foreground/70 max-w-sm">
                        This file type cannot be previewed in the browser. Use the download button to access it.
                    </p>
                )}
            </div>
        </div>
    );
}
