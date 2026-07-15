"use client";

import React from "react";
import { ApprovalsFetchProvider } from "./providers/fetchProvider";
import { useApprovals } from "./hooks/useApprovals";
import { ApprovalsTable } from "./components/ApprovalsTable";
import { ShieldAlert, ArrowDownCircle, Users, Activity } from "lucide-react";

const ApprovalsContent = () => {
    const {
        pendingItems,
        isLoading,
        handleApprove,
        handleReject,
    } = useApprovals();

    // Stats calculations
    const totalPending = pendingItems.length;
    const targetPendingCount = pendingItems.filter(i => i.type === "target").length;
    const headcountPendingCount = pendingItems.filter(i => i.type === "headcount").length;

    return (
        <div className="flex-1 space-y-8 p-6 pt-8 h-full overflow-auto bg-gradient-to-br from-background via-background/95 to-primary/[0.03]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1.5">
                    <h2 className="text-3xl font-black tracking-tight text-foreground leading-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary/80 bg-clip-text text-transparent">
                        Manufacturing Approvals
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.25em] opacity-80 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Target deviations & headcount limits override queue
                    </p>
                </div>
            </div>

            {/* Premium Stat Summary Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <Activity className="h-24 w-24" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                            <ShieldAlert className="h-3 w-3 text-amber-500" /> Pending Requests
                        </p>
                        <span className="text-3xl font-black tracking-tight tabular-nums block">
                            {totalPending}
                        </span>
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Combined tasks requiring action
                        </p>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <ArrowDownCircle className="h-24 w-24" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                            <ArrowDownCircle className="h-3 w-3 text-amber-500" /> Target Deviations
                        </p>
                        <span className="text-3xl font-black tracking-tight tabular-nums block text-amber-600">
                            {targetPendingCount}
                        </span>
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Shifts scheduled below target limits
                        </p>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/10 group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-foreground group-hover:scale-110 transition-transform">
                        <Users className="h-24 w-24" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                            <Users className="h-3 w-3 text-orange-500" /> Headcount Overrides
                        </p>
                        <span className="text-3xl font-black tracking-tight tabular-nums block text-orange-600">
                            {headcountPendingCount}
                        </span>
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Positions assigned above headcount cap
                        </p>
                    </div>
                </div>
            </div>

            <ApprovalsTable
                data={pendingItems}
                onApprove={handleApprove}
                onReject={handleReject}
                isLoading={isLoading}
            />
        </div>
    );
};

export const ApprovalsModule = () => {
    return (
        <ApprovalsFetchProvider>
            <ApprovalsContent />
        </ApprovalsFetchProvider>
    );
};
