"use client";

import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useClearanceDashboard } from "./hooks/useClearanceDashboard";
import {
    ClearanceDashboardKpiSkeleton,
    ClearanceDashboardKpiStrip,
} from "./components/ClearanceDashboardKpiStrip";
import { ClearanceTrendChart } from "./components/ClearanceTrendChart";
import { ClearanceStatusMixChart } from "./components/ClearanceStatusMixChart";
import { ClearanceTemplateChart } from "./components/ClearanceTemplateChart";
import { ClearanceAgingChart } from "./components/ClearanceAgingChart";
import { ClearanceOldestOpenPanel } from "./components/ClearanceOldestOpenPanel";
import { formatPHT } from "./utils/time";

const FOCUS_RING =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function LoadingState() {
    return (
        <div className="space-y-4 sm:space-y-5">
            <ClearanceDashboardKpiSkeleton />
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
                <div className="min-w-0 lg:col-span-12">
                    <Skeleton className="h-80 rounded-2xl" />
                </div>
            </div>
        </div>
    );
}

export function ClearanceDashboardModule() {
    const { data, isLoading, refreshing, error, refresh } = useClearanceDashboard();
    const busy = isLoading || refreshing;

    if (error !== null && data === null && !isLoading) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-4">
                    <span>Failed to load the clearance dashboard: {error}</span>
                    <Button variant="outline" size="sm" onClick={() => void refresh()} className={`ml-4 shrink-0 ${FOCUS_RING}`}>
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
                            Clearance · Analytics
                        </p>
                        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                            Clearance dashboard
                        </h1>
                        <p className="mt-1 text-sm font-normal text-muted-foreground">
                            How clearance is progressing, where it stalls, and who is waiting.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void refresh()}
                            disabled={busy}
                            aria-label="Refresh dashboard"
                            className={`rounded-full bg-card ${FOCUS_RING}`}
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
                                    <Button variant="outline" size="sm" onClick={() => void refresh()} className={`ml-4 shrink-0 ${FOCUS_RING}`}>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Retry
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        )}
                        <ClearanceDashboardKpiStrip kpis={data.kpis} />
                        <div className="grid items-stretch gap-4 lg:grid-cols-12">
                            <div className="min-w-0 lg:col-span-8">
                                <ClearanceTrendChart trend={data.trend} referenceAvg={data.trend_avg} />
                            </div>
                            <div className="min-w-0 lg:col-span-4">
                                <ClearanceStatusMixChart slices={data.status_mix} />
                            </div>
                        </div>
                        <div className="grid items-stretch gap-4 lg:grid-cols-12">
                            <div className="min-w-0 lg:col-span-7">
                                <ClearanceTemplateChart rows={data.by_template} />
                            </div>
                            <div className="min-w-0 lg:col-span-5">
                                <ClearanceAgingChart bins={data.aging} staleAfterDays={data.stale_after_days} />
                            </div>
                        </div>
                        <div className="grid items-stretch gap-4 lg:grid-cols-12">
                            <div className="min-w-0 lg:col-span-12">
                                <ClearanceOldestOpenPanel rows={data.oldest_open} totalOpen={data.oldest_open_total} />
                            </div>
                        </div>
                        <p className="text-xs tabular-nums text-muted-foreground">
                            Updated {formatPHT(data.generated_at)} ·{" "}
                            {data.scope === "hr" ? "Organization-wide" : "Your department"} ·{" "}
                            {data.kpis.completed_count} of {data.kpis.total} completed.
                        </p>
                    </React.Fragment>
                )}
            </div>
        </div>
    );
}
