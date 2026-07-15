"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, XCircle, ArrowDownCircle, Users, Factory } from "lucide-react";
import type { PendingApprovalItem } from "../types";
import { format } from "date-fns";

export const createColumns = (
    onApprove: (id: string, type: "target" | "headcount", refId: number) => void,
    onReject: (id: string, type: "target" | "headcount", refId: number) => void
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
        accessorKey: "type",
        header: "Override Type",
        cell: ({ row }) => {
            const type = row.original.type;
            return type === "target" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-500/25 bg-amber-500/5 text-[9px] font-black text-amber-700 uppercase tracking-wider">
                    <ArrowDownCircle className="h-3 w-3" /> Target Deviation
                </span>
            ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-orange-500/25 bg-orange-500/5 text-[9px] font-black text-orange-700 uppercase tracking-wider">
                    <Users className="h-3 w-3" /> Headcount Override
                </span>
            );
        },
    },
    {
        id: "details",
        header: "Deviation Details",
        cell: ({ row }) => {
            const item = row.original;
            if (item.type === "target" && item.target_value) {
                const diff = item.target_value.standard - item.target_value.requested;
                return (
                    <div className="flex flex-col gap-0.5 py-1">
                        <span className="font-bold text-xs text-foreground">
                            Target: {item.target_value.requested.toLocaleString()} pcs
                        </span>
                        <span className="text-[10px] text-muted-foreground font-semibold">
                            Standard standard is {item.target_value.standard.toLocaleString()} pcs (Diff: -{diff} pcs)
                        </span>
                    </div>
                );
            } else if (item.type === "headcount" && item.headcount_value) {
                const diff = item.headcount_value.assigned - item.headcount_value.allowed;
                return (
                    <div className="flex flex-col gap-0.5 py-1">
                        <span className="font-bold text-xs text-foreground">
                            {item.headcount_value.position_name}: {item.headcount_value.assigned} persons
                        </span>
                        <span className="text-[10px] text-muted-foreground font-semibold">
                            Allowed Limit is {item.headcount_value.allowed} max (Override: +{diff})
                        </span>
                    </div>
                );
            }
            return null;
        },
    },
    {
        id: "actions",
        header: "Review Actions",
        cell: ({ row }) => {
            const item = row.original;
            const refId = item.type === "target"
                ? item.schedule_id
                : item.headcount_value?.position_item_id || 0;

            return (
                <div className="flex items-center gap-2">
                    <Button
                        size="xs"
                        onClick={() => onApprove(item.id, item.type, refId)}
                        className="h-7 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest gap-1 shadow-md shadow-emerald-600/10 active:scale-95 transition-all"
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                        size="xs"
                        variant="outline"
                        onClick={() => onReject(item.id, item.type, refId)}
                        className="h-7 px-3.5 rounded-xl border-destructive/20 text-destructive hover:bg-destructive hover:text-white text-[9px] font-black uppercase tracking-widest gap-1 active:scale-95 transition-all"
                    >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                </div>
            );
        },
    },
];
