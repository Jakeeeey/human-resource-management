/* eslint-disable */
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format, parse, differenceInMinutes, isValid } from "date-fns";
import { CheckCircle2, Factory, Hash, Calendar, Loader2 } from "lucide-react";
import type { ProductionSchedule, ScheduleAttendance } from "../../production-scheduling/types";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { ProductionOutputService } from "../services/ProductionOutputService";

function LiveCostCell({ schedule }: { schedule: ProductionSchedule }) {
    const [cost, setCost] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchCost = async () => {
            try {
                // If it's posted, we could ideally just show the saved actual cost, but we don't have it saved on the schedule object.
                // We'll calculate it live.
                const attendanceLogs = await ProductionOutputService.getScheduleAttendance(schedule.id);
                
                let workingHours = 8;
                if (schedule.start_time && schedule.end_time) {
                    const start = schedule.start_time.split(":");
                    const end = schedule.end_time.split(":");
                    const startH = parseInt(start[0], 10) + parseInt(start[1], 10)/60;
                    const endH = parseInt(end[0], 10) + parseInt(end[1], 10)/60;
                    const elapsedHours = endH > startH ? endH - startH : (endH + 24) - startH;
                    workingHours = Math.max(0, elapsedHours - 1);
                }

                const hasManuPositions = schedule.manu_hr_schedule_positions && schedule.manu_hr_schedule_positions.length > 0;
                const posData = hasManuPositions ? schedule.manu_hr_schedule_positions! : (schedule.positions || []);

                const computeMetrics = (log: ScheduleAttendance) => {
                    if (!schedule?.start_time || !schedule?.end_time || !log.time_in) return null;
                    const schedDateStr = schedule.schedule_date;
                    if (!schedDateStr) return null;
                    
                    const expectedStart = parse(`${schedDateStr} ${schedule.start_time}`, 'yyyy-MM-dd HH:mm:ss', new Date());
                    const expectedEnd = parse(`${schedDateStr} ${schedule.end_time}`, 'yyyy-MM-dd HH:mm:ss', new Date());
                    
                    const timeIn = new Date(log.time_in);
                    const timeOut = log.time_out ? new Date(log.time_out) : null;

                    let totalWorkingMins = 0;
                    if (timeOut && isValid(timeIn)) {
                        totalWorkingMins = differenceInMinutes(timeOut, timeIn);
                        if (log.lunch_start && log.lunch_end) {
                            totalWorkingMins -= differenceInMinutes(new Date(log.lunch_end), new Date(log.lunch_start));
                        }
                        if (log.break_start && log.break_end) {
                            totalWorkingMins -= differenceInMinutes(new Date(log.break_end), new Date(log.break_start));
                        }
                        if (totalWorkingMins < 0) totalWorkingMins = 0;
                    }

                    return { workingHoursRaw: totalWorkingMins };
                };

                const totalActualCost = posData.reduce((acc, pos) => {
                    const posAttendance = attendanceLogs.filter(a => a.position_id === pos.position?.id && a.time_in) || [];
                    const hourlyRate = Number(pos.position?.position_rate || 0) / 8;
                    
                    const posCost = posAttendance.reduce((posAcc, log) => {
                        const metrics = computeMetrics(log);
                        if (metrics) {
                            if (metrics.workingHoursRaw > 0) {
                                return posAcc + ((metrics.workingHoursRaw / 60) * hourlyRate);
                            } else {
                                return posAcc + (workingHours * hourlyRate);
                            }
                        }
                        return posAcc;
                    }, 0);
                    
                    return acc + posCost;
                }, 0);

                if (isMounted) setCost(totalActualCost);
            } catch (error) {
                console.error("Failed to fetch live cost:", error);
                if (isMounted) setCost(0);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchCost();
        return () => { isMounted = false; };
    }, [schedule]);

    if (isLoading) {
        return (
            <div className="flex flex-col gap-0.5 animate-pulse opacity-50">
                <span className="font-bold text-xs tabular-nums text-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Calculating...
                </span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-0.5">
            <span className="font-bold text-xs tabular-nums text-foreground">
                ₱{(cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-emerald-600/70 font-black tracking-widest uppercase">
                Actual Cost
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
        id: "est_labor_cost",
        header: "Cost Analysis",
        cell: ({ row }) => {
            return <LiveCostCell schedule={row.original} />;
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
