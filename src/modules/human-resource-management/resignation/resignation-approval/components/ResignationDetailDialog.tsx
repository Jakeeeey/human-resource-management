"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Download, FileWarning, Loader2, RefreshCw } from "lucide-react";
import { formatDateOnly, formatPHT } from "@/modules/human-resource-management/shared/utils/time";
import { RESIGNATION_STATUS_LABELS } from "../types";
import type { ResignationRequestWithUser } from "../types";

interface ResignationDetailDialogProps {
    isOpen: boolean;
    onClose: () => void;
    data: ResignationRequestWithUser | null;
}

type AttachmentPreview =
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; url: string; mime: string };

export function ResignationDetailDialog({ isOpen, onClose, data }: ResignationDetailDialogProps) {
    const [preview, setPreview] = useState<AttachmentPreview>({ status: "loading" });
    const [reloadKey, setReloadKey] = useState(0);

    const fileUrl = data?.view_file_url ?? (data && data.attachment_uuid
        ? `/api/hrm/resignation/resignation-approval/${data.id}/file`
        : null);
    const fileName = data?.attachment_name ?? "Attachment";

    useEffect(() => {
        if (!isOpen || !fileUrl) {
            return;
        }
        let cancelled = false;
        let createdUrl: string | null = null;
        fetch(fileUrl, { cache: "no-store" })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error("Preview failed");
                }
                const blob = await response.blob();
                if (cancelled) {
                    return;
                }
                createdUrl = URL.createObjectURL(blob);
                setPreview({ status: "ready", url: createdUrl, mime: blob.type.toLowerCase() });
            })
            .catch(() => {
                if (!cancelled) {
                    setPreview({ status: "error" });
                }
            });
        return () => {
            cancelled = true;
            if (createdUrl) {
                URL.revokeObjectURL(createdUrl);
            }
        };
    }, [isOpen, fileUrl, reloadKey]);

    if (!data) {
        return null;
    }

    const fullName = [data.user_fname, data.user_mname, data.user_lname]
        .filter(Boolean)
        .join(" ");

    const handleRetry = () => {
        setPreview({ status: "loading" });
        setReloadKey((key) => key + 1);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Resignation Request Details</DialogTitle>
                    <DialogDescription>
                        Complete details for the resignation request
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-3 border-b pb-4">
                        <h3 className="font-semibold text-sm">Employee Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Full Name</p>
                                <p className="font-medium truncate max-w-60" title={fullName}>{fullName}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Department</p>
                                <p className="font-medium truncate max-w-60" title={data.department_name ?? "N/A"}>
                                    {data.department_name ?? "N/A"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 border-b pb-4">
                        <h3 className="font-semibold text-sm">Request Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Resignation Date</p>
                                <p className="font-medium">{formatDateOnly(data.resignation_date)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Filed Date</p>
                                <p className="font-medium">{formatPHT(data.filed_at)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Status</p>
                                <div className="mt-1">
                                    <Badge variant="secondary">
                                        {RESIGNATION_STATUS_LABELS[data.status]}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 border-b pb-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-2">Reason</p>
                            <p className="font-medium text-sm bg-muted p-2 rounded whitespace-pre-wrap break-all overflow-hidden">
                                {data.reason || "N/A"}
                            </p>
                        </div>
                        {data.hr_remarks && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-2">HR Remarks</p>
                                <p className="font-medium text-sm bg-muted p-2 rounded whitespace-pre-wrap break-all overflow-hidden">
                                    {data.hr_remarks}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-semibold text-sm">Attachment</h3>
                        {!fileUrl ? (
                            <p className="text-sm text-muted-foreground">
                                No attachment was filed with this request.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium truncate max-w-75" title={fileName}>
                                        {fileName}
                                    </p>
                                    <Button asChild variant="outline" size="sm">
                                        <a href={fileUrl} download={fileName}>
                                            <Download className="h-3.5 w-3.5" />
                                            Download
                                        </a>
                                    </Button>
                                </div>
                                <div className="rounded-xl border bg-muted/20 overflow-hidden">
                                    {preview.status === "loading" ? (
                                        <div className="flex h-[40vh] flex-col items-center justify-center gap-2">
                                            <Loader2 className="h-7 w-7 text-primary animate-spin" />
                                            <span className="text-xs font-semibold text-muted-foreground animate-pulse">
                                                Loading preview...
                                            </span>
                                        </div>
                                    ) : preview.status === "error" ? (
                                        <div className="flex h-[40vh] flex-col items-center justify-center gap-3 px-6 text-center">
                                            <AlertCircle className="h-8 w-8 text-rose-500" />
                                            <p className="text-xs font-bold text-rose-700">
                                                Could not load preview
                                            </p>
                                            <Button
                                                size="sm"
                                                className="h-8 text-xs font-bold gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
                                                onClick={handleRetry}
                                            >
                                                <RefreshCw className="h-3 w-3" />
                                                Retry
                                            </Button>
                                        </div>
                                    ) : preview.mime.startsWith("image/") ? (
                                        <div className="flex items-center justify-center bg-zinc-950/5 p-4 max-h-[60vh]">
                                            <Image
                                                src={preview.url}
                                                alt={fileName}
                                                width={800}
                                                height={600}
                                                unoptimized
                                                className="max-w-full max-h-[56vh] object-contain rounded-lg shadow-sm"
                                            />
                                        </div>
                                    ) : preview.mime === "application/pdf" ? (
                                        <div className="h-[60vh] bg-zinc-100">
                                            <iframe
                                                src={preview.url}
                                                title={fileName}
                                                className="w-full h-full border-0"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
                                            <div className="p-3 rounded-full bg-amber-500/10">
                                                <FileWarning className="h-6 w-6 text-amber-600" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-semibold text-foreground">No preview available</p>
                                                <p className="text-xs text-muted-foreground/70 max-w-sm">
                                                    This file type cannot be previewed in the browser. Use the download
                                                    button to access it.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
