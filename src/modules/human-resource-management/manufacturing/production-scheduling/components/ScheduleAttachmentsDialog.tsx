/* eslint-disable */
"use client";

import React, { useEffect, useState, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip, UploadCloud, FileIcon, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import type { ProductionSchedule, ScheduleAttachment } from "../types";
import { AttachmentService } from "../services/AttachmentService";
import { toast } from "sonner";

interface ScheduleAttachmentsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    schedule: ProductionSchedule | null;
}

export function ScheduleAttachmentsDialog({
    open,
    onOpenChange,
    schedule,
}: ScheduleAttachmentsDialogProps) {
    const [attachments, setAttachments] = useState<ScheduleAttachment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchAttachments = async () => {
        if (!schedule) return;
        setIsLoading(true);
        try {
            const data = await AttachmentService.getAttachments(schedule.id);
            setAttachments(data);
        } catch (error) {
            console.error("Failed to fetch attachments:", error);
            toast.error("Failed to load attachments");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (open && schedule) {
            fetchAttachments();
        } else {
            setAttachments([]);
        }
    }, [open, schedule]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0 || !schedule) return;

        // Copy the files array before resetting the input
        const files = Array.from(fileList);

        // Reset input so the same files can be selected again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }

        setIsUploading(true);
        try {
            const validFiles = files.filter(file => {
                const isDuplicate = attachments.some(
                    a => a.file_name === file.name && a.file_size_bytes === file.size
                );
                if (isDuplicate) {
                    toast.error(`"${file.name}" is already attached.`);
                    return false;
                }
                return true;
            });

            if (validFiles.length === 0) {
                setIsUploading(false);
                return;
            }

            // Optional: get user ID from cookie if you want to pass it
            let userId = null;
            const match = document.cookie.match(/vos_access_token=([^;]+)/);
            if (match) {
                try {
                    const payload = JSON.parse(atob(match[1].split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
                    userId = parseInt(payload.id || payload.sub || payload.user_id, 10) || null;
                } catch {}
            }

            const uploadPromises = validFiles.map(file => 
                AttachmentService.uploadAttachment(schedule.id, file, userId)
            );

            await Promise.all(uploadPromises);
            
            toast.success(`${validFiles.length} attachment${validFiles.length > 1 ? 's' : ''} uploaded successfully`);
            await fetchAttachments();
        } catch (error: any) {
            console.error("Upload failed:", error);
            toast.error(error.message || "Failed to upload attachments");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (attachmentId: number) => {
        setDeletingId(attachmentId);
        try {
            await AttachmentService.deleteAttachment(attachmentId);
            toast.success("Attachment deleted");
            setAttachments(prev => prev.filter(a => a.id !== attachmentId));
        } catch (error: any) {
            console.error("Delete failed:", error);
            toast.error("Failed to delete attachment");
        } finally {
            setDeletingId(null);
        }
    };

    const formatBytes = (bytes: number, decimals = 2) => {
        if (!+bytes) return "0 Bytes";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="p-0 sm:max-w-[550px] max-h-[85vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col bg-background/95 backdrop-blur-sm">
                <DialogHeader className="p-6 pb-4 border-b bg-muted/20 relative">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl shadow-inner ring-1 ring-primary/20">
                                <Paperclip className="h-6 w-6 text-primary" />
                            </div>
                            <div className="space-y-0.5">
                                <DialogTitle className="text-xl font-black tracking-tighter text-foreground leading-none">
                                    Schedule Attachments
                                </DialogTitle>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                                    {schedule?.line?.line_name || `Line #${schedule?.line_id}`} • {schedule?.schedule_date}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={fetchAttachments}
                            disabled={isLoading}
                            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Upload Area */}
                    <div 
                        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${isUploading ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5'}`}
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            multiple
                            onChange={handleFileChange}
                            disabled={isUploading}
                        />
                        <div className="flex flex-col items-center justify-center gap-3">
                            {isUploading ? (
                                <div className="bg-primary/10 p-4 rounded-full">
                                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                </div>
                            ) : (
                                <div className="bg-muted/30 p-4 rounded-full">
                                    <UploadCloud className="h-8 w-8 text-muted-foreground/70" />
                                </div>
                            )}
                            <div>
                                <h4 className="text-sm font-black text-foreground uppercase tracking-widest">
                                    {isUploading ? "Uploading..." : "Click to Upload"}
                                </h4>
                                <p className="text-xs text-muted-foreground font-medium mt-1">
                                    Max file size: 20MB
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Attachments List */}
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                            <Paperclip className="h-3 w-3" /> Uploaded Files
                        </h4>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : attachments.length > 0 ? (
                            <div className="space-y-2">
                                {attachments.map((file) => (
                                    <div key={file.id} className="flex items-center justify-between p-3 rounded-xl border bg-card/40 hover:bg-card/80 transition-colors group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="bg-muted p-2 rounded-lg shrink-0">
                                                <FileIcon className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-bold text-foreground truncate" title={file.file_name}>
                                                    {file.file_name}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                                                    {file.file_size_bytes ? formatBytes(file.file_size_bytes) : "Unknown size"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {file.file_path && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    asChild
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                >
                                                    <a href={`${process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "")}${file.file_path}`} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(file.id)}
                                                disabled={deletingId === file.id}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            >
                                                {deletingId === file.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/10 border border-dashed rounded-xl">
                                <FileIcon className="h-6 w-6 text-muted-foreground/30 mb-2" />
                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
                                    No attachments yet
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-4 border-t bg-muted/10 flex items-center justify-end shadow-[0_-8px_15px_-10px_rgba(0,0,0,0.05)]">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl px-8 font-black h-9 text-[10px] uppercase opacity-70 border border-muted-foreground/10 hover:opacity-100 transition-all hover:bg-background hover:shadow-sm"
                    >
                        CLOSE
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
