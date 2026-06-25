"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Loader2,
    Download,
    FileWarning,
    X,
    Paperclip,
} from "lucide-react";
import { formatPHT } from "../lib/format-pht";
import { EnrichedEmployeeConcernAttachment } from "../types/employee-concern.schema";

interface AttachmentPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    attachment: EnrichedEmployeeConcernAttachment | null;
}

/** Decides how an attachment can be previewed in-browser. */
function previewKind(att: EnrichedEmployeeConcernAttachment) {
    const type = (att.file_type ?? "").toLowerCase();
    const ext = (att.file_name ?? "").split(".").pop()?.toLowerCase() ?? "";

    if (type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"].includes(ext)) {
        return "image" as const;
    }
    if (type.startsWith("video/") || ["mp4", "webm", "ogv", "mov", "mkv"].includes(ext)) {
        if (type.startsWith("video/") || ["mp4", "webm", "ogv"].includes(ext)) {
            return "video" as const;
        }
        // .mov/.mkv often not natively playable → fall through to "none".
    }
    if (type === "application/pdf" || ext === "pdf") {
        return "pdf" as const;
    }
    if (
        type.startsWith("text/") ||
        type === "application/json" ||
        type === "application/javascript" ||
        type === "application/xml" ||
        ["txt", "md", "markdown", "json", "csv", "log", "html", "htm", "xml", "js", "ts", "tsx", "css", "yml", "yaml"].includes(ext)
    ) {
        return "text" as const;
    }
    return "none" as const;
}

function PdfFrame({ url, fileName }: { url: string; fileName: string }) {
    return (
        <div className="h-[60vh] overflow-auto bg-zinc-100">
            <iframe
                src={url}
                title={fileName}
                className="w-full h-full border-0"
            />
        </div>
    );
}

export function AttachmentPreviewDialog({
    open,
    onOpenChange,
    attachment,
}: AttachmentPreviewDialogProps) {
    const kind = useMemo(() => (attachment ? previewKind(attachment) : "none"), [attachment]);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [textError, setTextError] = useState<string | null>(null);

    const viewUrl = attachment?.view_url;
    const downloadUrl = viewUrl ? `${viewUrl}?download=1` : null;

    useEffect(() => {
        if (!open || !attachment || !viewUrl || kind !== "text") {
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
    }, [open, attachment, viewUrl, kind]);

    if (!attachment) return null;

    const uploadedAt = attachment.created_at ? formatPHT(attachment.created_at, false) : "—";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="sm:max-w-[900px] overflow-hidden p-0 rounded-2xl border-2 shadow-2xl animate-in fade-in zoom-in-95"
            >
                <div className="bg-gradient-to-r from-primary/10 via-background to-primary/5 p-5 pb-3">
                    <DialogHeader>
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
                                <Paperclip className="h-5 w-5 text-primary stroke-[2.5px]" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <DialogTitle className="text-lg font-bold tracking-tight line-clamp-1">
                                    {attachment.file_name}
                                </DialogTitle>
                                <DialogDescription className="text-xs font-medium opacity-70">
                                    {attachment.file_type || "Unknown type"}
                                    {attachment.created_by_name && <> · uploaded by {attachment.created_by_name}</>}
                                    {" · "}
                                    {uploadedAt}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <Separator className="bg-primary/10" />

                {/* Preview canvas */}
                <div className="p-5">
                    <div className="rounded-xl border bg-muted/20 overflow-hidden">
                        {kind === "image" && viewUrl && (
                            <div className="flex items-center justify-center bg-zinc-950/5 p-4 max-h-[60vh]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={viewUrl}
                                    alt={attachment.file_name}
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
                            <PdfFrame url={viewUrl} fileName={attachment.file_name} />
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
                                    <pre className="text-xs font-mono whitespace-pre-wrap break-words p-4 text-foreground/90 select-none pointer-events-none">
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

                {/* Footer: download + close */}
                <div className="px-5 pb-5 pt-0 flex flex-col sm:flex-row gap-3">
                    {downloadUrl && (
                        <Button
                            type="button"
                            asChild
                            className="flex-1 h-11 rounded-xl font-bold shadow-lg shadow-primary/20"
                        >
                            <a href={downloadUrl} download={attachment.file_name}>
                                <Download className="mr-2 h-4 w-4" />
                                Download
                            </a>
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="sm:flex-1 h-11 rounded-xl font-bold text-muted-foreground hover:bg-muted"
                    >
                        <X className="mr-2 h-4 w-4" />
                        Close
                    </Button>
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