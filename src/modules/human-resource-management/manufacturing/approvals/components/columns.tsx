/* eslint-disable */
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, XCircle, ArrowDownCircle, Users, Factory, AlertTriangle } from "lucide-react";
import type { PendingApprovalItem } from "../types";
import { format } from "date-fns";

export const createColumns = (
    onApprove: (scheduleId: number) => void,
    onReject: (scheduleId: number) => void
): ColumnDef<PendingApprovalItem>[] => [
    {
        accessorKey: "date",
        header: "Schedule Date",
        cell: ({ row }) => {
            const dateStr = row.original.date;
            let formattedDate = dateStr;
            try {
                formattedDate = format(new Date(dateStr), "MMM dd, yyyy");
            } catch {}
            return (
                <div className="flex items-center gap-3 py-1">
                    <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                        <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-extrabold text-[13px] text-foreground tracking-tight">
                        {formattedDate}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: "line_name",
        header: "Production Line",
        cell: ({ row }) => (
            <div className="flex items-center gap-3">
                <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                    <Factory className="h-4 w-4 text-primary" />
                </div>
                <span className="font-bold text-xs tracking-tight text-foreground truncate max-w-[150px]">
                    {row.original.line_name}
                </span>
            </div>
        ),
    },
    {
        accessorKey: "created_by",
        header: "Requested By",
        cell: ({ row }) => {
            const rawSched = row.original.raw_schedule as any;
            const creator = rawSched.user_created || rawSched.created_by;
            
            let creatorName = "System";
            let initials = "S";
            
            if (creator && typeof creator === "object" && (creator.first_name || creator.last_name)) {
                creatorName = `${creator.first_name || ""} ${creator.last_name || ""}`.trim();
                initials = (creator.first_name?.[0] || "") + (creator.last_name?.[0] || "");
            } else if (creator) {
                creatorName = `User #${creator}`;
                initials = creator.toString().substring(0, 2);
            }

            return (
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary uppercase">
                        {initials || "U"}
                    </div>
                    <span className="font-semibold text-[11px] text-muted-foreground truncate max-w-[100px]">
                        {creatorName}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: "type",
        header: "Override Issues",
        cell: ({ row }) => {
            const dev = row.original.deviations;
            const issues = [];
            if (dev.target) {
                issues.push(
                    <span key="target" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-500/25 bg-amber-500/5 text-[9px] font-black text-amber-700 uppercase tracking-wider">
                        <ArrowDownCircle className="h-3 w-3" /> Target Deviation
                    </span>
                );
            }
            const overrides = dev.headcounts?.filter(h => h.assigned > h.allowed) || [];
            if (overrides.length > 0) {
                issues.push(
                    <span key="headcount" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-orange-500/25 bg-orange-500/5 text-[9px] font-black text-orange-700 uppercase tracking-wider">
                        <Users className="h-3 w-3" /> Headcount Override ({overrides.length})
                    </span>
                );
            }
            return (
                <div className="flex flex-col gap-1.5 items-start">
                    {issues}
                </div>
            );
        },
    },
    {
        id: "details",
        header: "Deviation Details",
        cell: ({ row }) => {
            const dev = row.original.deviations;
            
            return (
                <div className="flex flex-col gap-2 py-1 max-w-[250px]">
                    {dev.target && (
                        <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-xs text-foreground flex items-center gap-1">
                                <ArrowDownCircle className="h-3 w-3 text-amber-500" /> Target: {dev.target.requested.toLocaleString()} pcs
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                                Standard is {dev.target.standard.toLocaleString()} pcs (Diff: -{dev.target.standard - dev.target.requested} pcs)
                            </span>
                        </div>
                    )}
                    
                    {dev.headcounts && dev.headcounts.map((hc, idx) => {
                        const isOverride = hc.assigned > hc.allowed;
                        return (
                            <div key={idx} className="flex flex-col gap-0.5">
                                <span className={`font-bold text-xs flex items-center gap-1 ${isOverride ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    <Users className={`h-3 w-3 ${isOverride ? 'text-orange-500' : 'text-muted-foreground/60'}`} /> {hc.position_name}: {hc.assigned} persons
                                </span>
                                <span className="text-[10px] text-muted-foreground font-semibold">
                                    Allowed Limit is {hc.allowed} max {isOverride && <span className="text-orange-600 font-bold">(Override: +{hc.assigned - hc.allowed})</span>}
                                </span>
                            </div>
                        );
                    })}
                </div>
            );
        },
    },
    {
        id: "actions",
        header: "Review Actions",
        cell: ({ row }) => {
            const item = row.original;

            return (
                <div className="flex items-center gap-2">
                    <Button
                        size="xs"
                        onClick={() => onApprove(item.schedule_id)}
                        className="h-7 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest gap-1 shadow-md shadow-emerald-600/10 active:scale-95 transition-all"
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                        size="xs"
                        variant="outline"
                        onClick={() => onReject(item.schedule_id)}
                        className="h-7 px-3.5 rounded-xl border-destructive/20 text-destructive hover:bg-destructive hover:text-white text-[9px] font-black uppercase tracking-widest gap-1 active:scale-95 transition-all"
                    >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                </div>
            );
        },
    },
];
