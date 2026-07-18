"use client";

import { useDashboard } from "@/modules/human-resource-management/manufacturing/dashboard/hooks/useDashboard";
import { StatCards } from "@/modules/human-resource-management/manufacturing/dashboard/components/StatCards";
import { ProductivityChart } from "@/modules/human-resource-management/manufacturing/dashboard/components/ProductivityChart";
import { WorkforceChart } from "@/modules/human-resource-management/manufacturing/dashboard/components/WorkforceChart";
import { AiInsightsCard } from "@/modules/human-resource-management/manufacturing/dashboard/components/AiInsightsCard";
import { DashboardDateFilter } from "@/modules/human-resource-management/manufacturing/dashboard/components/DashboardDateFilter";
import { Loader2, RefreshCcw, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ManufacturingDashboardPage() {
    const { stats, lines, isLoading, error, filter, updateFilter, refresh } = useDashboard();

    return (
        <div className="flex-1 overflow-y-auto h-full">
            <div className="space-y-6 p-8 pt-6 max-w-[1600px] mx-auto w-full min-h-full pb-20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-black tracking-tight flex items-center gap-2">
                            <Activity className="h-8 w-8 text-emerald-600" />
                            Manufacturing Dashboard
                        </h2>
                        <p className="text-muted-foreground mt-1 font-medium">
                            Monitor production output, workforce productivity, and performance metrics.
                        </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        <DashboardDateFilter 
                            startDate={filter.startDate} 
                            endDate={filter.endDate}
                            lineId={filter.lineId}
                            lines={lines}
                            onChange={(type, value) => updateFilter({ [type]: value })}
                        />
                        <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={refresh}
                            disabled={isLoading}
                            className="h-9 w-9 rounded-xl shrink-0"
                        >
                            <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin text-emerald-600' : 'text-muted-foreground'}`} />
                        </Button>
                    </div>
                </div>

                {error ? (
                    <div className="flex flex-col items-center justify-center h-[400px] rounded-2xl border bg-rose-500/5 text-rose-600 space-y-4">
                        <p className="font-bold text-lg">Failed to load dashboard data</p>
                        <p className="text-sm opacity-80">{error}</p>
                        <Button variant="outline" onClick={refresh}>Try Again</Button>
                    </div>
                ) : isLoading && !stats ? (
                    <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                        <p className="text-sm text-muted-foreground font-medium animate-pulse">Gathering productivity metrics...</p>
                    </div>
                ) : stats ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <StatCards stats={stats} />
                        <AiInsightsCard stats={stats} />
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <ProductivityChart data={stats.chartData} />
                            <WorkforceChart data={stats.chartData} />
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
