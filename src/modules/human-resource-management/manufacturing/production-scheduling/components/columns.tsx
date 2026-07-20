"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Calendar, Target, ShieldAlert, CheckCircle2, UserCheck, Users, Factory, Clock, Paperclip } from "lucide-react";
import type { ProductionSchedule } from "../types";
import { format } from "date-fns";

export const createColumns = (
    onEdit: (schedule: ProductionSchedule) => void,
    onDelete: (schedule: ProductionSchedule) => void,
    onAttachments?: (schedule: ProductionSchedule) => void
): ColumnDef<ProductionSchedule>[] => [
    {
        accessorKey: "schedule_date",
        header: "Schedule Date",
        cell: ({ row }) => {
            const dateStr = row.original.schedule_date;
            let formattedDate = dateStr;
            try {
                formattedDate = format(new Date(dateStr), "MMM dd, yyyy");
            } catch {}
            return (
                <div className="flex flex-col gap-1 py-1">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                            <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-extrabold text-[13px] text-foreground tracking-tight">
                            {formattedDate}
                        </span>
                    </div>
                    {(row.original.start_time && row.original.end_time) && (
                        <div className="flex items-center gap-1.5 ml-11">
                            <Clock className="h-3 w-3 text-muted-foreground/60" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {row.original.start_time} - {row.original.end_time}
                            </span>
                        </div>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: "line_id",
        header: "Production Line",
        cell: ({ row }) => (
            <div className="flex items-center gap-3">
                <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                    <Factory className="h-4 w-4 text-primary" />
                </div>
                <span className="font-bold text-xs tracking-tight text-foreground truncate max-w-[150px]">
                    {row.original.line?.line_name || `Line #${row.original.line_id}`}
                </span>
            </div>
        ),
    },
    {
        accessorKey: "daily_target",
        header: "Daily Target",
        cell: ({ row }) => {
            const standardTarget = row.original.line?.target_produce_8_hrs || 0;
            const isBelowTarget = row.original.daily_target < standardTarget;
            
            let status = "NOT_REQUIRED";
            if (isBelowTarget) {
                const overallStatus = row.original.approval_status || row.original.target_approval_status;
                if (overallStatus === "APPROVED") {
                    status = "APPROVED";
                } else if (overallStatus === "REJECTED") {
                    status = "REJECTED";
                } else {
                    status = "PENDING_APPROVAL";
                }
            }

            return (
                <div className="flex flex-col gap-1.5 py-1">
                    <div className="flex items-center gap-2">
                        <Target className="h-3.5 w-3.5 text-muted-foreground/60" />
                        <span className="font-black text-sm text-foreground tabular-nums">
                            {row.original.daily_target.toLocaleString()} pcs
                        </span>
                    </div>

                    {status === "PENDING_APPROVAL" && (
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/25 bg-amber-500/5 text-[9px] font-black text-amber-700 uppercase tracking-wider">
                                <ShieldAlert className="h-2.5 w-2.5" /> Target Pending
                            </span>
                        </div>
                    )}

                    {status === "APPROVED" && (
                        <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full border border-green-500/25 bg-green-500/5 text-[9px] font-black text-green-700 uppercase tracking-wider">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Approved
                        </span>
                    )}

                    {status === "REJECTED" && (
                        <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full border border-destructive/25 bg-destructive/5 text-[9px] font-black text-destructive uppercase tracking-wider">
                            <ShieldAlert className="h-2.5 w-2.5" /> Target Rejected
                        </span>
                    )}

                    {status === "NOT_REQUIRED" && (
                        <span className="text-[9px] font-bold text-muted-foreground/55 uppercase tracking-widest pl-5">
                            Within Limits
                        </span>
                    )}
                </div>
            );
        },
    },
    {
        id: "headcount_status",
        header: "Position Headcounts",
        cell: ({ row }) => {
            const rawPositions = row.original.positions || row.original.manu_hr_schedule_positions || [];
            // Group/deduplicate by position_id to prevent duplicates in the UI
            const uniqueMap = new Map<number, typeof rawPositions[0]>();
            rawPositions.forEach((p) => {
                uniqueMap.set(p.position_id, p);
            });
            const positions = Array.from(uniqueMap.values());
            
            return (
                <div className="flex flex-col gap-1.5 py-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground/60">
                        <Users className="h-3.5 w-3.5" />
                        <span className="text-xs font-semibold tabular-nums">
                            {positions.length} position(s) configured
                        </span>
                    </div>

                    {positions.map((pos) => {
                        const posName = pos.position?.position_name || `Pos #${pos.position_id}`;
                        const allowed = pos.position?.persons_allowed || 0;
                        const isDeviation = pos.assigned_persons > allowed;
                        
                        let posStatus = pos.headcount_approval_status;
                        const overallStatus = row.original.approval_status || row.original.target_approval_status;
                        
                        // Fallback to schedule's overall approval status if the child wasn't explicitly updated
                        if (posStatus === "PENDING_APPROVAL" && (overallStatus === "APPROVED" || overallStatus === "REJECTED")) {
                            posStatus = overallStatus;
                        }

                        return (
                            <div key={pos.id} className="flex items-center justify-between gap-3 bg-muted/20 border border-muted-foreground/5 rounded-lg p-1.5">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] font-black text-foreground truncate max-w-[120px]">
                                        {posName}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground tabular-nums font-semibold">
                                        Assigned: {pos.assigned_persons} (Max: {allowed})
                                    </span>
                                </div>
                                {isDeviation && posStatus === "PENDING_APPROVAL" && (
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-amber-700 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                        Pending
                                    </span>
                                )}
                                {posStatus === "APPROVED" && (
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-green-700 bg-green-500/10 px-1.5 py-0.5 rounded">
                                        <UserCheck className="h-2.5 w-2.5" /> OK
                                    </span>
                                )}
                                {posStatus === "REJECTED" && (
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                                        Rejected
                                    </span>
                                )}
                            </div>
                        );
                    })}

                    {!positions.some(p => p.headcount_approval_status === "PENDING_APPROVAL" || p.headcount_approval_status === "APPROVED" || p.headcount_approval_status === "REJECTED" || p.assigned_persons > (p.position?.persons_allowed || 0)) && (
                        <span className="text-[9px] font-bold text-muted-foreground/55 uppercase tracking-widest pl-5">
                            Within Limits
                        </span>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: "actual_produce",
        header: "Actual Output",
        cell: ({ row }) => (
            <span className="font-bold text-sm text-foreground tabular-nums">
                {(row.original.actual_produce || 0).toLocaleString()} pcs
            </span>
        ),
    },
    {
        id: "actions",
        header: "Controls",
        cell: ({ row }) => {
            const overallStatus = row.original.approval_status || row.original.target_approval_status;
            const isLocked = overallStatus === "APPROVED" || overallStatus === "REJECTED";
            const tooltipMessage = overallStatus === "APPROVED" 
                ? "Approved schedule cannot be modified" 
                : overallStatus === "REJECTED" 
                    ? "Rejected schedule cannot be modified" 
                    : "Edit Schedule";

            return (
                <div className="flex items-center gap-1.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        title={tooltipMessage}
                        onClick={() => onEdit(row.original)}
                        disabled={isLocked}
                        className="h-8.5 w-8.5 rounded-xl text-muted-foreground hover:bg-muted active:scale-90 transition-all border border-transparent hover:border-muted-foreground/10 disabled:opacity-30"
                    >
                        <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Manage Attachments"
                        onClick={() => onAttachments?.(row.original)}
                        className="h-8.5 w-8.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 active:scale-90 transition-all border border-transparent hover:border-primary/10"
                    >
                        <Paperclip className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        title={isLocked ? tooltipMessage : "Delete Schedule"}
                        onClick={() => onDelete(row.original)}
                        disabled={isLocked}
                        className="h-8.5 w-8.5 rounded-xl text-destructive hover:bg-destructive/10 active:scale-90 transition-all border border-transparent hover:border-destructive/10 disabled:opacity-30"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            );
        },
    },
];
