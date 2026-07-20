/* eslint-disable */
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { CheckCircle2, Factory, Hash, Calendar } from "lucide-react";
import type { ProductionSchedule } from "../../production-scheduling/types";
import { Button } from "@/components/ui/button";

export const getColumns = (
    onUpdateOutput: (schedule: ProductionSchedule) => void
): ColumnDef<ProductionSchedule>[] => [
    {
        accessorKey: "schedule_date",
        header: "Schedule Date",
        cell: ({ row }) => {
            const dateStr = row.original.schedule_date;
            if (!dateStr) return null;
            return (
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                        {format(new Date(dateStr), "MMM dd, yyyy")}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: "line",
        header: "Production Line",
        cell: ({ row }) => {
            const line = row.original.line;
            const lineId = typeof row.original.line_id === 'object' ? (row.original.line_id as any)?.id : row.original.line_id;
            
            return (
                <div className="flex items-center gap-2">
                    <div className="bg-primary/10 p-1.5 rounded-lg border border-primary/20">
                        <Factory className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-semibold text-foreground">
                        {line?.line_name || `Line #${lineId}`}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: "daily_target",
        header: "Target Output",
        cell: ({ row }) => (
            <div className="flex items-center gap-2 font-mono text-muted-foreground">
                <Hash className="h-3 w-3" />
                {(row.original.daily_target || 0).toLocaleString()} pcs
            </div>
        ),
    },
    {
        accessorKey: "actual_produce",
        header: "Actual Output",
        cell: ({ row }) => {
            const actual = row.original.actual_produce || 0;
            const target = row.original.daily_target || 0;
            const percentage = target > 0 ? Math.round((actual / target) * 100) : 0;
            const boundedPercentage = Math.min(percentage, 100);
            
            let colorClass = "bg-muted-foreground";
            let textColorClass = "text-muted-foreground";
            let bgLightClass = "bg-muted";
            let borderColorClass = "border-muted-foreground/20";
            
            if (percentage >= 100) {
                colorClass = "bg-emerald-500";
                textColorClass = "text-emerald-700 dark:text-emerald-400";
                bgLightClass = "bg-emerald-500/10";
                borderColorClass = "border-emerald-500/20";
            } else if (percentage >= 50) {
                colorClass = "bg-amber-500";
                textColorClass = "text-amber-700 dark:text-amber-400";
                bgLightClass = "bg-amber-500/10";
                borderColorClass = "border-amber-500/20";
            } else if (percentage > 0) {
                colorClass = "bg-rose-500";
                textColorClass = "text-rose-700 dark:text-rose-400";
                bgLightClass = "bg-rose-500/10";
                borderColorClass = "border-rose-500/20";
            }

            return (
                <div className={`flex flex-col gap-1.5 p-2 rounded-xl border ${borderColorClass} ${bgLightClass} w-48 transition-all hover:scale-[1.02]`}>
                    <div className="flex items-center justify-between font-mono text-xs font-black">
                        <span className={textColorClass}>
                            {actual.toLocaleString()} / {target.toLocaleString()}
                        </span>
                        <span className={textColorClass}>{percentage}%</span>
                    </div>
                    <div className="h-2 w-full bg-background rounded-full overflow-hidden shadow-inner">
                        <div 
                            className={`h-full ${colorClass} rounded-full transition-all duration-1000 ease-out relative overflow-hidden`}
                            style={{ width: `${boundedPercentage}%` }}
                        >
                            {/* Shimmer effect for progress bar */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                        </div>
                    </div>
                </div>
            );
        },
    },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
            const schedule = row.original;
            const isPosted = schedule.is_output_posted === true;
            
            return (
                <Button
                    variant={isPosted ? "default" : "outline"}
                    size="sm"
                    className={`font-bold text-[10px] tracking-wider uppercase h-8 transition-all ${
                        isPosted ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 cursor-not-allowed opacity-100 border-none shadow-none" : ""
                    }`}
                    onClick={() => !isPosted && onUpdateOutput(schedule)}
                    disabled={isPosted}
                >
                    {isPosted ? (
                        <>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                            POSTED
                        </>
                    ) : (
                        "POST OUTPUT"
                    )}
                </Button>
            );
        },
    },
];
