/* eslint-disable */
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Calendar, Factory, Target, Users, Clock } from "lucide-react";
import type { ProductionSchedule } from "../../production-scheduling/types";

export const createColumns = (): ColumnDef<ProductionSchedule>[] => [
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
        id: "line_name",
        header: "Production Line",
        cell: ({ row }) => {
            const line = row.original.line as any;
            const lineName = line?.line_name || `Line #${row.original.line_id}`;
            return (
                <div className="flex items-center gap-3">
                    <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                        <Factory className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-bold text-xs tracking-tight text-foreground truncate max-w-[150px]">
                        {lineName}
                    </span>
                </div>
            );
        },
    },
    {
        id: "time",
        header: "Shift Time",
        cell: ({ row }) => {
            const start = row.original.start_time;
            const end = row.original.end_time;

            if (!start || !end) {
                return (
                    <span className="text-[11px] font-medium text-muted-foreground">
                        Legacy (Full Day)
                    </span>
                );
            }

            // Format time assuming HH:mm:ss string
            const formatTime = (t: string) => {
                const [h, m] = t.split(":");
                let hours = parseInt(h, 10);
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12; 
                return `${hours}:${m} ${ampm}`;
            };

            return (
                <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="font-semibold text-xs tracking-tight text-foreground">
                        {formatTime(start)} - {formatTime(end)}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: "daily_target",
        header: "Target (Pcs)",
        cell: ({ row }) => {
            const target = row.original.daily_target;
            return (
                <div className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="font-bold text-xs tabular-nums text-foreground">
                        {target.toLocaleString()}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: "actual_produce",
        header: "Actual Output",
        cell: ({ row }) => {
            const actual = row.original.actual_produce || 0;
            const target = row.original.daily_target || 0;
            const percent = target > 0 ? ((actual / target) * 100).toFixed(1) : 0;
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-xs tabular-nums text-foreground">
                        {actual.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 font-semibold">
                        {percent}%
                    </span>
                </div>
            );
        },
    },
    {
        id: "manpower",
        header: "Manpower",
        cell: ({ row }) => {
            const positions = row.original.positions || row.original.manu_hr_schedule_positions || [];
            const totalManpower = positions.reduce((acc: number, p: any) => acc + (p.assigned_persons || 0), 0);
            return (
                <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="font-bold text-xs tabular-nums text-foreground">
                        {totalManpower}
                    </span>
                </div>
            );
        },
    },
    {
        id: "est_labor_cost",
        header: "Est. Labor Cost",
        cell: ({ row }) => {
            const positions = row.original.positions || row.original.manu_hr_schedule_positions || [];
            const totalCost = positions.reduce((acc: number, p: any) => {
                const rate = p.position?.position_rate || 0;
                const persons = p.assigned_persons || 0;
                // Cost for the shift. If rate is hourly, we'd need shift hours. 
                // Assuming position_rate is a daily rate for simplicity, or we compute based on start/end time.
                // Let's check how it's defined. Usually position_rate is per day or per hour.
                // Let's just multiply rate * persons for a standard 8 hr shift if rate is hourly.
                // Wait, if it's hourly, let's use an 8-hour multiplier as baseline, or if it's daily rate, just rate * persons.
                // Without knowing, we'll do: persons * rate.
                return acc + (persons * rate);
            }, 0);

            // Let's adjust based on: "the rate here is 8hrs of work then 1 hr of break"
            let workingHours = 8; // Default full day of work
            let elapsedHours = 9; 
            
            if (row.original.start_time && row.original.end_time) {
                const start = row.original.start_time.split(":");
                const end = row.original.end_time.split(":");
                const startH = parseInt(start[0], 10) + parseInt(start[1], 10)/60;
                const endH = parseInt(end[0], 10) + parseInt(end[1], 10)/60;
                elapsedHours = endH > startH ? endH - startH : (endH + 24) - startH;
                
                // Deduct 1 hour for break
                workingHours = Math.max(0, elapsedHours - 1);
            }
            
            // Recompute total cost: daily rate is for 8 hrs of work.
            const actualTotalCost = positions.reduce((acc: number, p: any) => {
                const dailyRate = p.position?.position_rate || 0;
                const hourlyRate = dailyRate / 8; // Calculate hourly rate
                const persons = p.assigned_persons || 0;
                return acc + (persons * hourlyRate * workingHours);
            }, 0);

            return (
                <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-xs tabular-nums text-foreground">
                        ₱{actualTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 font-semibold">
                        {workingHours.toFixed(1)} hrs work
                    </span>
                </div>
            );
        },
    },
    {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.original.approval_status || row.original.target_approval_status || "NOT_REQUIRED";
            
            const badges: Record<string, { label: string, classes: string }> = {
                NOT_REQUIRED: {
                    label: "Auto Approved",
                    classes: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
                },
                APPROVED: {
                    label: "Approved",
                    classes: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
                },
                PENDING_APPROVAL: {
                    label: "Pending Review",
                    classes: "bg-amber-500/10 text-amber-700 border-amber-500/20",
                },
                REJECTED: {
                    label: "Rejected",
                    classes: "bg-destructive/10 text-destructive border-destructive/20",
                },
            };

            const config = badges[status] || badges.NOT_REQUIRED;

            return (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${config.classes}`}>
                    {config.label}
                </span>
            );
        },
    },
    {
        id: "created_by",
        header: "Requested By",
        cell: ({ row }) => {
            const sched = row.original as any;
            const creator = sched.user_created || sched.created_by;
            
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
    }
];
