"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Loader2,
    X,
    MessageSquareWarning,
    CalendarClock,
    UserCircle2,
    Eye,
    PlayCircle,
    CheckCircle2,
    XCircle,
    Paperclip,
    FileText,
    Image as ImageIcon,
    FileSpreadsheet,
    FileVideo,
    FileAudio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPHT } from "../lib/format-pht";
import {
    EnrichedEmployeeConcern,
    ConcernStatus,
    EnrichedEmployeeConcernAttachment,
} from "../types/employee-concern.schema";
import { StatusBadge } from "./columns";
import { AttachmentPreviewDialog } from "./AttachmentPreviewDialog";

interface EmployeeConcernDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    concern: EnrichedEmployeeConcern | null;
    onStatusUpdate: (id: number, status: ConcernStatus) => Promise<boolean>;
}

/** Picks an icon + tint colour based on the attachment's MIME type or extension. */
function getAttachmentIcon(fileType?: string | null, fileName?: string) {
    const type = (fileType ?? "").toLowerCase();
    const ext = (fileName ?? "").split(".").pop()?.toLowerCase() ?? "";

    if (type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) {
        return { Icon: ImageIcon, tint: "text-violet-600 bg-violet-500/10" };
    }
    if (type.startsWith("video/") || ["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) {
        return { Icon: FileVideo, tint: "text-pink-600 bg-pink-500/10" };
    }
    if (type.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) {
        return { Icon: FileAudio, tint: "text-amber-600 bg-amber-500/10" };
    }
    if (
        type.includes("spreadsheet") || type.includes("excel") ||
        ["xlsx", "xls", "csv", "ods"].includes(ext)
    ) {
        return { Icon: FileSpreadsheet, tint: "text-emerald-600 bg-emerald-500/10" };
    }
    if (
        type === "application/pdf" || ext === "pdf"
    ) {
        return { Icon: FileText, tint: "text-red-600 bg-red-500/10" };
    }
    return { Icon: Paperclip, tint: "text-sky-600 bg-sky-500/10" };
}

export function EmployeeConcernDetailDialog({
    open,
    onOpenChange,
    concern,
    onStatusUpdate,
}: EmployeeConcernDetailDialogProps) {
    const [pendingStatus, setPendingStatus] = useState<ConcernStatus | null>(null);
    const [attachments, setAttachments] = useState<EnrichedEmployeeConcernAttachment[]>([]);
    const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);
    const [previewAttachment, setPreviewAttachment] = useState<EnrichedEmployeeConcernAttachment | null>(null);

    const concernId = concern?.id;

    // Fetch attachments whenever the dialog opens for a specific concern.
    useEffect(() => {
        if (!open || !concernId) {
            setAttachments([]);
            setAttachmentError(null);
            return;
        }
        let cancelled = false;
        setIsLoadingAttachments(true);
        setAttachmentError(null);
        fetch(`/api/hrm/communications/employee-concerns/${concernId}/attachments`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to load attachments");
                const json = await res.json();
                if (!cancelled) setAttachments(json.data ?? []);
            })
            .catch((err: Error) => {
                if (!cancelled) setAttachmentError(err.message);
            })
            .finally(() => {
                if (!cancelled) setIsLoadingAttachments(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, concernId]);

    if (!concern) return null;

    const submittedName = concern.is_anonymous
        ? "Anonymous"
        : concern.user_name || concern.created_by_name || "—";
    const submittedDate = formatPHT(concern.created_at);

    const handleWorkflowAction = async (next: ConcernStatus) => {
        if (!concern.id) return;
        try {
            setPendingStatus(next);
            const ok = await onStatusUpdate(concern.id, next);
            if (ok) {
                onOpenChange(false);
                return;
            }
        } finally {
            setPendingStatus(null);
        }
    };

    const isBusy = (s: ConcernStatus) => pendingStatus === s;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="sm:max-w-[600px] overflow-hidden p-0 rounded-2xl border-2 shadow-2xl animate-in fade-in zoom-in-95">
                <div className="bg-gradient-to-r from-primary/10 via-background to-primary/5 p-6 pb-4">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <MessageSquareWarning className="h-6 w-6 text-primary stroke-[2.5px]" />
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-xl font-bold tracking-tight line-clamp-1">
                                    {concern.subject_of_concern}
                                </DialogTitle>
                                <DialogDescription className="text-xs font-medium opacity-70">
                                    Concern detail &mdash; advance the concern through its workflow.
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <StatusBadge status={concern.status} />
                        </div>
                    </DialogHeader>
                </div>

                <Separator className="bg-primary/10" />

                <div className="p-6 space-y-6">
                    {/* Meta row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                Submitted By
                            </span>
                            <div className="flex items-center gap-2">
                                <UserCircle2 className="h-4 w-4 text-muted-foreground/60" />
                                <span className="text-sm font-medium">{submittedName}</span>
                            </div>
                            {concern.user_email && !concern.is_anonymous && (
                                <span className="text-[11px] text-muted-foreground/70 block pl-6">
                                    {concern.user_email}
                                </span>
                            )}
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                Submitted On
                            </span>
                            <div className="flex items-center gap-2">
                                <CalendarClock className="h-4 w-4 text-muted-foreground/60" />
                                <span className="text-sm font-medium">{submittedDate}</span>
                            </div>
                        </div>
                    </div>

                    {/* Concern body */}
                    <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                            Concern
                        </span>
                        <div className="rounded-xl border bg-muted/20 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 max-h-64 overflow-y-auto text-justify">
                            {concern.concern}
                        </div>
                    </div>

                    {/* Attachments */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                Attachments
                            </span>
                            {attachments.length > 0 && (
                                <span className="text-[10px] font-semibold text-muted-foreground/60">
                                    {attachments.length} {attachments.length === 1 ? "file" : "files"}
                                </span>
                            )}
                        </div>

                        {isLoadingAttachments ? (
                            <div className="flex items-center justify-center gap-2 rounded-xl border bg-muted/20 py-6 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading attachments...
                            </div>
                        ) : attachmentError ? (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/5 py-4 px-4 text-sm text-red-600">
                                {attachmentError}
                            </div>
                        ) : attachments.length === 0 ? (
                            <div className="flex items-center gap-2 rounded-xl border border-dashed bg-muted/10 py-4 px-4 text-sm text-muted-foreground/60">
                                <Paperclip className="h-4 w-4" />
                                No attachments for this concern.
                            </div>
                        ) : (
                            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                {attachments.map((att) => {
                                    const { Icon, tint } = getAttachmentIcon(att.file_type, att.file_name);
                                    return (
                                        <li
                                            key={att.id}
                                            className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/30"
                                        >
                                            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tint)}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-foreground">
                                                    {att.file_name}
                                                </p>
                                                <p className="truncate text-[11px] text-muted-foreground/70">
                                                    {att.file_type || "Unknown type"}
                                                    {att.created_at && <> · {formatPHT(att.created_at, false)}</>}
                                                </p>
                                            </div>
                                            {att.view_url && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPreviewAttachment(att)}
                                                    className="shrink-0 rounded-lg h-8 px-3"
                                                >
                                                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                                                    Preview
                                                </Button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {/* Workflow Actions — hidden for terminal states (status is in header badge) */}
                    {concern.status !== "RESOLVED" && concern.status !== "DISMISSED" && (
                        <div className="space-y-3 rounded-xl border-2 border-primary/15 p-5 bg-primary/[0.03]">
                            <span className="block text-xs font-bold uppercase tracking-wider text-primary/80">
                                Workflow Actions
                            </span>

                            {concern.status === "PENDING" && (
                                <Button
                                    onClick={() => handleWorkflowAction("IN_REVIEW")}
                                    disabled={isBusy("IN_REVIEW")}
                                    className={cn(
                                        "h-11 w-full rounded-xl font-bold shadow-lg shadow-primary/20 transition-all",
                                        "bg-blue-600 hover:bg-blue-700 text-white"
                                    )}
                                >
                                    {isBusy("IN_REVIEW") ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Starting review...
                                        </>
                                    ) : (
                                        <>
                                            <PlayCircle className="mr-2 h-4 w-4" />
                                            Start Review
                                        </>
                                    )}
                                </Button>
                            )}

                            {concern.status === "IN_REVIEW" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Button
                                        onClick={() => handleWorkflowAction("RESOLVED")}
                                        disabled={isBusy("RESOLVED")}
                                        className={cn(
                                            "h-11 rounded-xl font-bold shadow-lg transition-all",
                                            "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                                        )}
                                    >
                                        {isBusy("RESOLVED") ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Resolving...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                                Resolve Concern
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        onClick={() => handleWorkflowAction("DISMISSED")}
                                        disabled={isBusy("DISMISSED")}
                                        className={cn(
                                            "h-11 rounded-xl font-bold shadow-lg transition-all",
                                            "bg-red-600 hover:bg-red-700 text-white shadow-red-600/20"
                                        )}
                                    >
                                        {isBusy("DISMISSED") ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Dismissing...
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="mr-2 h-4 w-4" />
                                                Dismiss Concern
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-6 pb-4 -mt-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="font-bold text-muted-foreground hover:bg-muted rounded-xl px-6 h-11 w-full"
                    >
                        <X className="mr-2 h-4 w-4" />
                        Close
                    </Button>
                </div>
            </DialogContent>

            {/* In-system attachment preview */}
            <AttachmentPreviewDialog
                open={previewAttachment !== null}
                onOpenChange={(o) => { if (!o) setPreviewAttachment(null); }}
                attachment={previewAttachment}
            />
        </Dialog>
    );
}