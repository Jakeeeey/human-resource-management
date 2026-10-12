"use client";

import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import { usePerformanceDashboard } from "./hooks/usePerformanceDashboard";
import {
    PerformanceDashboardKpiSkeleton,
    PerformanceDashboardKpiStrip,
} from "./components/PerformanceDashboardKpiStrip";
import { PerformanceTrendChart } from "./components/PerformanceTrendChart";
import { RatingMixChart } from "./components/RatingMixChart";
import { DepartmentComparisonChart } from "./components/DepartmentComparisonChart";
import { ScoreDistributionChart } from "./components/ScoreDistributionChart";
import { TopPerformersPanel } from "./components/TopPerformersPanel";
import { NeedsAttentionPanel } from "./components/NeedsAttentionPanel";

function LoadingState() {
    return (
        <div className="space-y-4 sm:space-y-5">
            <PerformanceDashboardKpiSkeleton />
            <div className="grid gap-4 lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-8">
                    <Skeleton className="h-80 rounded-2xl" />
                </div>
                <div className="min-w-0 lg:col-span-4">
                    <Skeleton className="h-80 rounded-2xl" />
                </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-7">
                    <Skeleton className="h-80 rounded-2xl" />
                </div>
                <div className="min-w-0 lg:col-span-5">
                    <Skeleton className="h-80 rounded-2xl" />
                </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-7">
                    <Skeleton className="h-80 rounded-2xl" />
                </div>
                <div className="min-w-0 lg:col-span-5">
                    <Skeleton className="h-80 rounded-2xl" />
                </div>
            </div>
        </div>
    );
}

export function PerformanceDashboardModule() {
    const { data, isLoading, refreshing, error, refresh } = usePerformanceDashboard();
    const busy = isLoading || refreshing;

    if (error !== null && data === null && !isLoading) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-4">
                    <span>Failed to load the performance dashboard: {error}</span>
                    <Button variant="outline" size="sm" onClick={() => void refresh()} className="ml-4 shrink-0">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="min-h-screen rounded-2xl bg-[#f2f2f9] p-3 sm:p-5 md:p-6 dark:bg-background">
            <div className="mx-auto max-w-[1400px] space-y-4 sm:space-y-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                            Performance evaluation · Analytics
                        </p>
                        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                            Performance dashboard
                        </h1>
                        <p className="mt-1 text-sm font-normal text-muted-foreground">
                            How performance is trending, where, and for whom.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void refresh()}
                            disabled={busy}
                            aria-label="Refresh dashboard"
                            className="rounded-full bg-card"
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
                            {refreshing && data !== null ? "Refreshing" : "Refresh"}
                        </Button>
                    </div>
                </div>
                {isLoading || data === null ? (
                    <LoadingState />
                ) : (
                    <React.Fragment>
                        {error !== null && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Refresh failed</AlertTitle>
                                <AlertDescription className="flex items-center justify-between gap-4">
                                    <span>Showing the last loaded data: {error}</span>
                                    <Button variant="outline" size="sm" onClick={() => void refresh()} className="ml-4 shrink-0">
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Retry
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        )}
                        <PerformanceDashboardKpiStrip kpis={data.kpis} />
                        <div className="grid items-stretch gap-4 lg:grid-cols-12">
                            <div className="min-w-0 lg:col-span-8">
                                <PerformanceTrendChart trend={data.trend} referenceAvg={data.kpis.avg_score} />
                            </div>
                            <div className="min-w-0 lg:col-span-4">
                                <RatingMixChart distribution={data.rating_distribution} />
                            </div>
                        </div>
                        <div className="grid items-stretch gap-4 lg:grid-cols-12">
                            <div className="min-w-0 lg:col-span-7">
                                <DepartmentComparisonChart departments={data.by_department} />
                            </div>
                            <div className="min-w-0 lg:col-span-5">
                                <ScoreDistributionChart distribution={data.score_distribution} />
                            </div>
                        </div>
                        <div className="grid items-stretch gap-4 lg:grid-cols-12">
                            <div className="min-w-0 lg:col-span-7">
                                <TopPerformersPanel performers={data.top_performers} />
                            </div>
                            <div className="min-w-0 lg:col-span-5">
                                <NeedsAttentionPanel items={data.needs_attention} pips={data.pips} />
                            </div>
                        </div>
                        <p className="text-xs tabular-nums text-muted-foreground">
                            Updated {new Date(data.generated_at).toLocaleString()} ·{" "}
                            {data.scope === "hr" ? "Organization-wide" : "Your department"} ·{" "}
                            {data.kpis.evaluated_count} of {data.kpis.total} evaluated.
                        </p>
                    </React.Fragment>
                )}
            </div>
        </div>
    );
}
