/* eslint-disable */
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format, parse, differenceInMinutes, isValid } from "date-fns";
import { CheckCircle2, Factory, Hash, Calendar, Loader2 } from "lucide-react";
import type { ProductionSchedule, ScheduleAttendance } from "../../production-scheduling/types";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { ProductionOutputService } from "../services/ProductionOutputService";

const liveCostCache = new Map<number, { cost: number, estCost: number }>();

function LiveCostCell({ schedule }: { schedule: ProductionSchedule }) {
    const cached = liveCostCache.get(schedule.id);
    const [cost, setCost] = useState<number | null>(cached ? cached.cost : null);
    const [estCost, setEstCost] = useState<number | null>(cached ? cached.estCost : null);
    const [isLoading, setIsLoading] = useState(!cached);

    useEffect(() => {
        let isMounted = true;
        const fetchCost = async () => {
            try {
                const attendanceLogs = await ProductionOutputService.getScheduleAttendance(schedule.id);
                
                const { actualCost: totalActualCost, estCost: totalEstCost } = ProductionOutputService.calculateScheduleCost(schedule, attendanceLogs);

                liveCostCache.set(schedule.id, { cost: totalActualCost, estCost: totalEstCost });

                if (isMounted) {
                    setCost(totalActualCost);
                    setEstCost(totalEstCost);
                }
            } catch (error) {
                console.error("Failed to fetch live cost:", error);
                if (isMounted && !cached) {
                    setCost(0);
                    setEstCost(0);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchCost();
        return () => { isMounted = false; };
    }, [schedule, cached]);

    if (isLoading) {
        return (
            <div className="flex flex-col gap-0.5 animate-pulse opacity-50">
                <div className="h-4 w-16 bg-muted rounded-md"></div>
                <div className="h-3 w-12 bg-muted rounded-md mt-1"></div>
            </div>
        );
    }

    const actualProduce = schedule.actual_produce || 0;
    const targetCpp = (schedule.daily_target || 0) > 0 ? (estCost || 0) / (schedule.daily_target || 1) : 0;
    const actualCpp = actualProduce > 0 ? (cost || 0) / actualProduce : 0;
    const isOver = actualProduce > 0 && actualCpp > targetCpp;

    return (
        <div className="flex flex-col gap-0.5">
            <span className={`font-bold text-xs tabular-nums ${isOver ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                ₱{(cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-[10px] font-black tracking-widest uppercase ${isOver ? 'text-rose-600/70' : 'text-emerald-600/70'}`}>
                Actual Cost
            </span>
        </div>
    );
}

function LiveCostPerPieceCell({ schedule }: { schedule: ProductionSchedule }) {
    const cached = liveCostCache.get(schedule.id);
    const [cost, setCost] = useState<number | null>(cached ? cached.cost : null);
    const [estCost, setEstCost] = useState<number | null>(cached ? cached.estCost : null);
    const [isLoading, setIsLoading] = useState(!cached);

    useEffect(() => {
        let isMounted = true;
        const fetchCost = async () => {
            try {
                const attendanceLogs = await ProductionOutputService.getScheduleAttendance(schedule.id);
                
                const { actualCost: totalActualCost, estCost: totalEstCost } = ProductionOutputService.calculateScheduleCost(schedule, attendanceLogs);

                liveCostCache.set(schedule.id, { cost: totalActualCost, estCost: totalEstCost });

                if (isMounted) {
                    setCost(totalActualCost);
                    setEstCost(totalEstCost);
                }
            } catch (error) {
                if (isMounted && !cached) {
                    setCost(0);
                    setEstCost(0);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchCost();
        return () => { isMounted = false; };
    }, [schedule, cached]);

    if (isLoading) {
        return (
            <div className="flex flex-col gap-0.5 animate-pulse opacity-50">
                <div className="h-6 w-20 bg-muted rounded-md"></div>
            </div>
        );
    }

    const actualProduce = schedule.actual_produce || 0;
    const targetCpp = (schedule.daily_target || 0) > 0 ? (estCost || 0) / (schedule.daily_target || 1) : 0;
    const actualCpp = actualProduce > 0 ? (cost || 0) / actualProduce : 0;
    const isOver = actualProduce > 0 && actualCpp > targetCpp;

    if (actualProduce === 0) {
        return (
            <span className="text-[10px] text-muted-foreground/50 font-semibold italic">
                Awaiting output...
            </span>
        );
    }

    return (
        <div className="flex flex-col">
            <span className={`text-[10.5px] font-black tabular-nums tracking-wider uppercase px-2.5 py-1 rounded-md border w-fit shadow-sm transition-colors ${
                isOver 
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20' 
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
            }`}>
                ₱{actualCpp.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} / pc
            </span>
        </div>
    );
}

export const getColumns = (
    onUpdateOutput: (schedule: ProductionSchedule) => void
): ColumnDef<ProductionSchedule>[] => [
    {
        accessorKey: "schedule_date",
        header: "Schedule Date",
        cell: ({ row }) => {
            const dateStr = row.original.schedule_date;
            const startTime = row.original.start_time;
            const endTime = row.original.end_time;
            if (!dateStr) return null;
            
            const formatTime = (timeStr?: string) => {
                if (!timeStr) return "";
                // Handle different time string formats
                const cleanTime = timeStr.length > 5 ? timeStr : `${timeStr}:00`;
                const date = parse(cleanTime, 'HH:mm:ss', new Date());
                return isValid(date) ? format(date, 'h:mm a') : timeStr;
            };

            const timeDisplay = startTime && endTime 
                ? `${formatTime(startTime)} - ${formatTime(endTime)}`
                : "";

            return (
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground whitespace-nowrap">
                            {format(new Date(dateStr), "MMM dd, yyyy")}
                        </span>
                    </div>
                    {timeDisplay && (
                        <div className="flex items-center gap-2 pl-6">
                            <span className="text-[10px] text-muted-foreground/70 font-semibold tracking-wide whitespace-nowrap">
                                {timeDisplay}
                            </span>
                        </div>
                    )}
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
        id: "est_labor_cost",
        header: "Cost Analysis",
        cell: ({ row }) => {
            return <LiveCostCell schedule={row.original} />;
        },
    },
    {
        id: "cost_per_piece",
        header: "Cost per Piece",
        cell: ({ row }) => {
            return <LiveCostPerPieceCell schedule={row.original} />;
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
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isPosted) onUpdateOutput(schedule);
                    }}
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
