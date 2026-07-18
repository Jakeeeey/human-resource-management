"use client";

import React from "react";
import { ScheduleSummaryProvider } from "./providers/fetchProvider";
import { useScheduleSummary } from "./hooks/useScheduleSummary";
import { SummaryTable } from "./components/SummaryTable";
import { Factory, Activity, CheckCircle2, AlertTriangle } from "lucide-react";

const ScheduleSummaryContent = () => {
    const { schedules, isLoading } = useScheduleSummary();

    // High level stats
    const totalSchedules = schedules.length;
    const approvedSchedules = schedules.filter(s => s.approval_status === "APPROVED" || s.approval_status === "NOT_REQUIRED" || s.target_approval_status === "APPROVED" || s.target_approval_status === "NOT_REQUIRED").length;
    const pendingSchedules = schedules.filter(s => s.approval_status === "PENDING_APPROVAL" || s.target_approval_status === "PENDING_APPROVAL").length;

    return (
        <div className="flex-1 flex flex-col space-y-8 p-6 pt-8 h-full overflow-hidden bg-gradient-to-br from-background via-background/95 to-primary/[0.03]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1.5">
                    <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary/80 bg-clip-text text-transparent">
                        Schedule Summary
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.25em] opacity-80 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                        Comprehensive overview of all production runs
                    </p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <Activity className="h-24 w-24" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                            <Factory className="h-3 w-3 text-blue-500" /> Total Schedules
                        </p>
                        <span className="text-3xl font-black tracking-tight tabular-nums block">
                            {totalSchedules}
                        </span>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="h-24 w-24" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Cleared & Approved
                        </p>
                        <span className="text-3xl font-black tracking-tight tabular-nums block text-emerald-600">
                            {approvedSchedules}
                        </span>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <AlertTriangle className="h-24 w-24" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3 text-amber-500" /> Pending Review
                        </p>
                        <span className="text-3xl font-black tracking-tight tabular-nums block text-amber-600">
                            {pendingSchedules}
                        </span>
                    </div>
                </div>
            </div>

            {/* Table wrapper for flex behavior */}
            <div className="flex-1 flex flex-col min-h-[400px]">
                <SummaryTable data={schedules} isLoading={isLoading} />
            </div>
        </div>
    );
};

export const ScheduleSummaryModule = () => {
    return (
        <ScheduleSummaryProvider>
            <ScheduleSummaryContent />
        </ScheduleSummaryProvider>
    );
};
