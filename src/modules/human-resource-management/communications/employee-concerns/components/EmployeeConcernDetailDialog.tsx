"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, X, MessageSquareWarning, CalendarClock, UserCircle2, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPHT } from "../lib/format-pht";
import {
    EnrichedEmployeeConcern,
    ConcernStatus,
    CONCERN_STATUSES,
    CONCERN_STATUS_LABELS,
} from "../types/employee-concern.schema";
import { StatusBadge } from "./columns";

interface EmployeeConcernDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    concern: EnrichedEmployeeConcern | null;
    onStatusUpdate: (id: number, status: ConcernStatus) => Promise<boolean>;
}

export function EmployeeConcernDetailDialog({
    open,
    onOpenChange,
    concern,
    onStatusUpdate,
}: EmployeeConcernDetailDialogProps) {
    const [nextStatus, setNextStatus] = useState<ConcernStatus>("PENDING");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (concern) {
            setNextStatus(concern.status);
        }
    }, [concern]);

    if (!concern) return null;

    const submittedName = concern.is_anonymous
        ? "Anonymous"
        : concern.user_name || concern.created_by_name || "—";
    const submittedDate = formatPHT(concern.created_at);
    const statusChanged = nextStatus !== concern.status;

    const handleSaveStatus = async () => {
        if (!statusChanged || !concern.id) return;
        try {
            setIsSaving(true);
            await onStatusUpdate(concern.id, nextStatus);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] overflow-hidden p-0 rounded-2xl border-2 shadow-2xl animate-in fade-in zoom-in-95">
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
                                    Concern detail &mdash; review and update the lifecycle status.
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <StatusBadge status={concern.status} />
                            {concern.is_anonymous && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border bg-zinc-500/10 text-zinc-500 border-zinc-500/20">
                                    <EyeOff className="h-3 w-3" />
                                    Anonymous
                                </span>
                            )}
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

                    {/* Admin status control */}
                    <div className="space-y-2 rounded-xl border-2 border-primary/10 p-4 bg-primary/[0.02]">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary/80">
                            Update Status
                        </span>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <Select
                                value={nextStatus}
                                onValueChange={(v) => setNextStatus(v as ConcernStatus)}
                            >
                                <SelectTrigger className="h-11 flex-1 rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CONCERN_STATUSES.map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {CONCERN_STATUS_LABELS[s]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={handleSaveStatus}
                                disabled={isSaving || !statusChanged}
                                className={cn(
                                    "h-11 sm:w-[160px] rounded-xl font-bold shadow-lg shadow-primary/20 transition-all",
                                    !statusChanged && "opacity-50"
                                )}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Status
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-6 pb-6 pt-0">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="font-bold text-muted-foreground hover:bg-muted rounded-xl px-6 h-11"
                    >
                        <X className="mr-2 h-4 w-4" />
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
