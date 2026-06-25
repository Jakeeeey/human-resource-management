"use client";

import React, { useState } from "react";
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
    EyeOff,
    PlayCircle,
    CheckCircle2,
    XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPHT } from "../lib/format-pht";
import {
    EnrichedEmployeeConcern,
    ConcernStatus,
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
    const [pendingStatus, setPendingStatus] = useState<ConcernStatus | null>(null);

    if (!concern) return null;

    const submittedName = concern.is_anonymous
        ? "Anonymous"
        : concern.user_name || concern.created_by_name || "—";
    const submittedDate = formatPHT(concern.created_at);

    const handleWorkflowAction = async (next: ConcernStatus) => {
        if (!concern.id) return;
        try {
            setPendingStatus(next);
            await onStatusUpdate(concern.id, next);
        } finally {
            setPendingStatus(null);
        }
    };

    const isBusy = (s: ConcernStatus) => pendingStatus === s;

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
                                    Concern detail &mdash; advance the concern through its workflow.
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

                    {/* Workflow Actions */}
                    <div className="space-y-3 rounded-xl border-2 border-primary/15 p-5 bg-primary/[0.03]">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-primary/80">
                                Workflow Actions
                            </span>
                            <StatusBadge status={concern.status} />
                        </div>

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

                        {(concern.status === "RESOLVED" || concern.status === "DISMISSED") && (
                            <div className="flex items-center justify-center py-2 text-center">
                                <span className="text-sm font-medium text-muted-foreground">
                                    {concern.status === "RESOLVED"
                                        ? "This concern is resolved. No further action needed."
                                        : "This concern has been dismissed. No further action needed."}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 pb-6 pt-0">
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
        </Dialog>
    );
}