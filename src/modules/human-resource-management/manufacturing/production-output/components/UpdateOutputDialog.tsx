/* eslint-disable */
"use client";

import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Paperclip, UploadCloud, FileIcon, Trash2, ExternalLink } from "lucide-react";
import type { ProductionSchedule, ScheduleAttachment, ScheduleAttendance } from "../../production-scheduling/types";
import { AttachmentService } from "../../production-scheduling/services/AttachmentService";
import { ProductionOutputService } from "../services/ProductionOutputService";
import { format, parse, differenceInMinutes, isValid } from "date-fns";
import { outputUpdateSchema } from "../types";
import { toast } from "sonner";

interface UpdateOutputDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (id: number, actualProduce: number, isPosted: boolean) => Promise<boolean>;
    schedule: ProductionSchedule | null;
}

export function UpdateOutputDialog({
    open,
    onOpenChange,
    onSubmit,
    schedule,
}: UpdateOutputDialogProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [actualProduce, setActualProduce] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    
    // Attendance
    const [attendanceLogs, setAttendanceLogs] = useState<ScheduleAttendance[]>([]);
    const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);

    // Attachments states
    const [attachments, setAttachments] = useState<ScheduleAttachment[]>([]);
    const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const fetchAttachments = async () => {
        if (!schedule) return;
        setIsLoadingAttachments(true);
        try {
            const data = await AttachmentService.getAttachments(schedule.id);
            setAttachments(data);
        } catch (error) {
            console.error("Failed to fetch attachments:", error);
        } finally {
            setIsLoadingAttachments(false);
        }
    };

    const fetchAttendance = async () => {
        if (!schedule) return;
        setIsLoadingAttendance(true);
        try {
            const data = await ProductionOutputService.getScheduleAttendance(schedule.id);
            setAttendanceLogs(data);
        } catch (error) {
            console.error("Failed to fetch attendance:", error);
        } finally {
            setIsLoadingAttendance(false);
        }
    };

    useEffect(() => {
        if (open && schedule) {
            setActualProduce(schedule.actual_produce || 0);
            setError(null);
            fetchAttachments();
            fetchAttendance();
        } else {
            setAttachments([]);
            setAttendanceLogs([]);
        }
    }, [open, schedule]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0 || !schedule) return;

        // Copy the files array before resetting the input
        const files = Array.from(fileList);

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

    const handleDeleteAttachment = async (attachmentId: number) => {
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

    const computeMetrics = (log: ScheduleAttendance) => {
        if (!schedule?.start_time || !schedule?.end_time || !log.time_in) return null;

        const schedDateStr = schedule.schedule_date; // e.g. '2026-07-18'
        if (!schedDateStr) return null;
        
        // Parse the schedule times
        const expectedStart = parse(`${schedDateStr} ${schedule.start_time}`, 'yyyy-MM-dd HH:mm:ss', new Date());
        const expectedEnd = parse(`${schedDateStr} ${schedule.end_time}`, 'yyyy-MM-dd HH:mm:ss', new Date());
        
        const timeIn = new Date(log.time_in);
        const timeOut = log.time_out ? new Date(log.time_out) : null;
        
        let lateMins = 0;
        if (isValid(expectedStart) && isValid(timeIn) && timeIn > expectedStart) {
            lateMins = differenceInMinutes(timeIn, expectedStart);
        }

        let undertimeMins = 0;
        if (timeOut && isValid(expectedEnd) && isValid(timeOut) && timeOut < expectedEnd) {
            undertimeMins = differenceInMinutes(expectedEnd, timeOut);
        }

        let totalWorkingMins = 0;
        if (timeOut && isValid(timeIn)) {
            totalWorkingMins = differenceInMinutes(timeOut, timeIn);
            
            // Subtract breaks
            if (log.lunch_start && log.lunch_end) {
                totalWorkingMins -= differenceInMinutes(new Date(log.lunch_end), new Date(log.lunch_start));
            }
            if (log.break_start && log.break_end) {
                totalWorkingMins -= differenceInMinutes(new Date(log.break_end), new Date(log.break_start));
            }
            if (totalWorkingMins < 0) totalWorkingMins = 0;
        }

        const formatDuration = (mins: number) => {
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            if (h > 0) return `${h}h ${m}m`;
            return `${m}m`;
        };

        return {
            late: lateMins > 0 ? formatDuration(lateMins) : null,
            undertime: undertimeMins > 0 ? formatDuration(undertimeMins) : null,
            workingHours: timeOut ? formatDuration(totalWorkingMins) : 'Incomplete',
            workingHoursRaw: totalWorkingMins
        };
    };

    const handleAction = async (isPosted: boolean) => {
        if (!schedule) return;

        const result = outputUpdateSchema.safeParse({ actual_produce: actualProduce });
        if (!result.success) {
            setError(result.error.issues[0].message);
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const success = await onSubmit(schedule.id, result.data.actual_produce, isPosted);
            if (success) {
                // Let the hook close the dialog
            }
        } catch (error) {
            console.error("Update failed:", error);
            setError("An unexpected error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="p-0 sm:max-w-[480px] max-h-[85vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col bg-background/95 backdrop-blur-sm">
                <DialogHeader className="p-6 pb-4 border-b bg-muted/20 relative shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-500/10 p-3 rounded-2xl shadow-inner ring-1 ring-emerald-500/20">
                            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div className="space-y-0.5">
                            <DialogTitle className="text-xl font-black tracking-tighter text-foreground leading-none">
                                Update Actual Output
                            </DialogTitle>
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                                    Record production results
                                </p>
                                {schedule?.start_time && schedule?.end_time && (
                                    <>
                                        <span className="text-muted-foreground/40 text-[10px]">•</span>
                                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">
                                            {format(parse(schedule.start_time, 'HH:mm:ss', new Date()), 'hh:mm a')} - {format(parse(schedule.end_time, 'HH:mm:ss', new Date()), 'hh:mm a')}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                    <div className="space-y-2">
                        <Label htmlFor="actual_produce" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                            Actual Output (pcs)
                        </Label>
                        <Input
                            id="actual_produce"
                            type="number"
                            min={0}
                            value={actualProduce === 0 && !schedule?.actual_produce ? "" : actualProduce}
                            onChange={(e) => setActualProduce(e.target.value === "" ? 0 : parseInt(e.target.value, 10))}
                            className="h-12 rounded-xl border-muted-foreground/20 focus-visible:ring-emerald-500/20 bg-card font-black text-lg tabular-nums shadow-inner"
                            placeholder="e.g. 1500"
                            autoFocus
                        />
                        {error && (
                            <p className="text-[10px] font-bold text-destructive">{error}</p>
                        )}
                        {(() => {
                            const target = schedule?.daily_target || 0;
                            if (target === 0) return (
                                <p className="text-[10px] text-muted-foreground font-medium mt-1">
                                    No target set
                                </p>
                            );
                            
                            const percentage = Math.round((actualProduce / target) * 100);
                            const boundedPercentage = Math.min(percentage, 100);
                            
                            let colorClass = "bg-muted-foreground";
                            let textColorClass = "text-muted-foreground";
                            
                            if (percentage >= 100) {
                                colorClass = "bg-emerald-500";
                                textColorClass = "text-emerald-600";
                            } else if (percentage >= 50) {
                                colorClass = "bg-amber-500";
                                textColorClass = "text-amber-600";
                            } else if (percentage > 0) {
                                colorClass = "bg-rose-500";
                                textColorClass = "text-rose-600";
                            }

                            return (
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between font-mono text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-muted-foreground">Target: {target.toLocaleString()}</span>
                                        <span className={textColorClass}>{percentage}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                                        <div 
                                            className={`h-full ${colorClass} rounded-full transition-all duration-300 ease-out`}
                                            style={{ width: `${boundedPercentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-muted/50">
                        <Label className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                            Actual Headcount
                        </Label>
                        {(() => {
                            const posData = schedule?.manu_hr_schedule_positions || schedule?.positions || [];
                            if (posData.length === 0) return <p className="text-[10px] text-muted-foreground">No positions assigned.</p>;
                            
                            return (
                                <div className="grid gap-3">
                                    {posData.map(pos => {
                                        const posAttendance = attendanceLogs.filter(a => a.position_id === pos.position?.id) || [];
                                        return (
                                        <div key={pos.id} className="flex flex-col gap-2 p-3 rounded-xl border bg-card/50 shadow-sm transition-all hover:bg-card">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold truncate">{pos.position?.position_name || "Unknown Position"}</p>
                                                </div>
                                                <div className="flex items-center gap-4 shrink-0">
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Set</p>
                                                        <p className="text-sm font-black tabular-nums">{pos.assigned_persons}</p>
                                                    </div>
                                                    <div className="h-8 w-px bg-muted-foreground/20" />
                                                    <div className="text-right w-24">
                                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1 text-center">Actual</p>
                                                        <div className="flex items-center justify-center h-8 bg-background border border-muted-foreground/20 rounded-md shadow-inner text-sm font-black tabular-nums">
                                                            {isLoadingAttendance ? <Loader2 className="h-3 w-3 animate-spin text-emerald-600" /> : posAttendance.length}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {posAttendance.length > 0 && (
                                                <div className="mt-2 space-y-2 border-t border-muted/50 pt-3">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Tapped In Workers</p>
                                                    {posAttendance.map(log => {
                                                        const name = log.user_id ? `${log.user_id.user_fname} ${log.user_id.user_lname}` : "Unknown User";
                                                        const formatTime = (t?: string | null) => t ? format(new Date(t), "hh:mm a") : "--:--";
                                                        const metrics = computeMetrics(log);
                                                        
                                                        return (
                                                            <div key={log.id} className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-background/50 border border-muted-foreground/10 text-[10px]">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-bold text-foreground text-xs">{name}</span>
                                                                    {metrics && (
                                                                        <div className="flex gap-2">
                                                                            {metrics.late && <span className="text-[9px] font-black uppercase text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-md border border-rose-500/20 shadow-sm">Late: {metrics.late}</span>}
                                                                            {metrics.undertime && <span className="text-[9px] font-black uppercase text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20 shadow-sm">Undertime: {metrics.undertime}</span>}
                                                                            <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20 shadow-sm">
                                                                                {metrics.workingHours === 'Incomplete' ? 'No Time Out' : `${metrics.workingHours} Total`}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="grid grid-cols-4 gap-2 text-muted-foreground font-medium mt-1">
                                                                    <div className="flex flex-col"><span className="text-[8.5px] font-black uppercase tracking-wider text-muted-foreground/60 mb-0.5">Time In</span><span className="text-foreground/90">{formatTime(log.time_in)}</span></div>
                                                                    <div className="flex flex-col"><span className="text-[8.5px] font-black uppercase tracking-wider text-muted-foreground/60 mb-0.5">Lunch</span><span className="text-foreground/90">{formatTime(log.lunch_start)} - {formatTime(log.lunch_end)}</span></div>
                                                                    <div className="flex flex-col"><span className="text-[8.5px] font-black uppercase tracking-wider text-muted-foreground/60 mb-0.5">Break</span><span className="text-foreground/90">{formatTime(log.break_start)} - {formatTime(log.break_end)}</span></div>
                                                                    <div className="flex flex-col"><span className="text-[8.5px] font-black uppercase tracking-wider text-muted-foreground/60 mb-0.5">Time Out</span><span className="text-foreground/90">{formatTime(log.time_out)}</span></div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )})}
                                </div>
                            );
                        })()}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-muted/50">
                        <Label className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                            <Paperclip className="h-3 w-3" /> Attachments / Proof
                        </Label>

                        {/* Upload Area */}
                        <div 
                            className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all ${isUploading ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-muted-foreground/20 hover:border-emerald-500/50 hover:bg-emerald-500/5'}`}
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
                            <div className="flex flex-col items-center justify-center gap-2">
                                {isUploading ? (
                                    <Loader2 className="h-6 w-6 text-emerald-600 animate-spin" />
                                ) : (
                                    <UploadCloud className="h-6 w-6 text-muted-foreground/70" />
                                )}
                                <div>
                                    <h4 className="text-xs font-black text-foreground uppercase tracking-widest">
                                        {isUploading ? "Uploading..." : "Click to Upload"}
                                    </h4>
                                </div>
                            </div>
                        </div>

                        {/* Attachments List */}
                        {isLoadingAttachments ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        ) : attachments.length > 0 ? (
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                {attachments.map((file) => (
                                    <div key={file.id} className="flex items-center justify-between p-2.5 rounded-xl border bg-card/40 hover:bg-card/80 transition-colors group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="bg-muted p-1.5 rounded-lg shrink-0">
                                                <FileIcon className="h-3.5 w-3.5 text-emerald-600" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-bold text-foreground truncate" title={file.file_name}>
                                                    {file.file_name}
                                                </span>
                                                <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
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
                                                    className="h-7 w-7 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-600/10"
                                                >
                                                    <a href={`${process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "")}${file.file_path}`} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </a>
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteAttachment(file.id)}
                                                disabled={deletingId === file.id}
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            >
                                                {deletingId === file.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>

                <DialogFooter className="p-6 py-4 border-t bg-muted/10 flex items-center justify-end gap-3 shadow-[0_-8px_15px_-10px_rgba(0,0,0,0.05)] shrink-0">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="flex-1 sm:flex-none rounded-xl px-6 font-black h-10 text-[10px] uppercase opacity-70 border border-muted-foreground/10 hover:opacity-100 transition-all hover:bg-background hover:shadow-sm"
                        disabled={isSaving}
                    >
                        CANCEL
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleAction(false)}
                        disabled={isSaving}
                        className="flex-1 sm:flex-none rounded-xl px-8 font-black h-10 text-[10px] uppercase tracking-widest transition-all active:scale-95"
                    >
                        {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                        ) : (
                            "SAVE DRAFT"
                        )}
                    </Button>
                    <Button
                        onClick={() => handleAction(true)}
                        disabled={isSaving}
                        className="flex-1 sm:flex-none rounded-xl px-12 font-black shadow-xl shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 h-10 text-[10px] uppercase tracking-widest transition-all active:scale-95 text-white"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            "POST OUTPUT"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
