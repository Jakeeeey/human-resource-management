"use client";

import React from "react";
import { ProductionOutputFetchProvider } from "./providers/fetchProvider";
import { useProductionOutput } from "./hooks/useProductionOutput";
import { OutputTable } from "./components/OutputTable";
import { UpdateOutputDialog } from "./components/UpdateOutputDialog";
import { CheckCircle2, TrendingUp, InboxIcon } from "lucide-react";

const ProductionOutputContent = () => {
    const {
        schedules,
        isLoading,
        selectedSchedule,
        isUpdateOpen,
        setIsUpdateOpen,
        promptUpdate,
        handleUpdateActualProduce,
    } = useProductionOutput();

    // Stats calculations
    const totalSchedules = schedules.length;
    const completedSchedules = schedules.filter(s => s.actual_produce > 0).length;
    const pendingSchedules = totalSchedules - completedSchedules;

    return (
        <div className="flex-1 space-y-8 p-6 pt-8 h-full overflow-auto bg-gradient-to-br from-background via-background/95 to-primary/[0.03]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1.5">
                    <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary/80 bg-clip-text text-transparent">
                        Production Output
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.25em] opacity-80 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Record and track actual production outputs
                    </p>
                </div>
            </div>

            {/* Premium Stat Summary Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <TrendingUp className="h-24 w-24" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                            <TrendingUp className="h-3 w-3 text-primary" /> Total Schedules
                        </p>
                        <span className="text-3xl font-black tracking-tight tabular-nums block">
                            {totalSchedules}
                        </span>
                        <p className="text-[10px] text-muted-foreground font-medium">
                            All tracked production schedules
                        </p>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="h-24 w-24" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Recorded Output
                        </p>
                        <span className="text-3xl font-black tracking-tight tabular-nums block text-emerald-600">
                            {completedSchedules}
                        </span>
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Schedules with recorded production
                        </p>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <InboxIcon className="h-24 w-24" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                            <InboxIcon className="h-3 w-3 text-amber-500" /> Pending Entry
                        </p>
                        <span className="text-3xl font-black tracking-tight tabular-nums block text-amber-600">
                            {pendingSchedules}
                        </span>
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Schedules awaiting output records
                        </p>
                    </div>
                </div>
            </div>

            <OutputTable
                data={schedules}
                onUpdateOutput={promptUpdate}
                isLoading={isLoading}
            />

            <UpdateOutputDialog
                open={isUpdateOpen}
                onOpenChange={setIsUpdateOpen}
                onSubmit={handleUpdateActualProduce}
                schedule={selectedSchedule}
            />
        </div>
    );
};

export const ProductionOutputModule = () => {
    return (
        <ProductionOutputFetchProvider>
            <ProductionOutputContent />
        </ProductionOutputFetchProvider>
    );
};
