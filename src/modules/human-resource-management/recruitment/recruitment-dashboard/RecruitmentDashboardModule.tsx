"use client";

import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useRecruitmentDashboard } from "./hooks/useRecruitmentDashboard";
import { ATTENTION_KEYS, PIPELINE_KEYS, AttentionHighlight, StageList, SummaryStrip } from "./components/QueueTiles";
import { VolumeChart } from "./components/VolumeChart";
import { PositionList } from "./components/BreakdownCards";
import type { Granularity, RecruitmentDashboardData } from "./types";

function LoadingState() {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
                <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
                <Skeleton className="h-80 rounded-2xl" />
            </div>
        </div>
    );
}

function summaryFigures(data: RecruitmentDashboardData): {
    readonly active: number;
    readonly hired: number;
    readonly attention: number;
} {
    const byKey = new Map(data.queues.map((tile) => [tile.key, tile.count]));
    const active = PIPELINE_KEYS.filter((key) => key !== "hired").reduce(
        (sum, key) => sum + (byKey.get(key) ?? 0),
        0
    );
    return {
        active,
        hired: byKey.get("hired") ?? 0,
        attention: ATTENTION_KEYS.reduce((sum, key) => sum + (byKey.get(key) ?? 0), 0),
    };
}

export default function RecruitmentDashboardModule() {
    const { data, isLoading, isError, errorMessage, reload } = useRecruitmentDashboard();
    const [granularity, setGranularity] = React.useState<Granularity>("day");

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                    <span>Failed to load the recruitment dashboard: {errorMessage ?? "Unknown error"}</span>
                    <Button variant="outline" size="sm" onClick={reload} className="ml-4">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    const figures = data === null ? null : summaryFigures(data);

    return (
        <div className="min-h-screen rounded-2xl bg-[#f2f2f9] p-3 sm:p-5 md:p-6 dark:bg-background">
            <div className="mx-auto max-w-[1400px] space-y-4 sm:space-y-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                            Recruitment · Onboarding
                        </p>
                        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                            Recruitment dashboard
                        </h1>
                        <p className="mt-1 text-sm font-normal text-muted-foreground">
                            Follow every applicant from application to hired.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={reload}
                            disabled={isLoading}
                            className="rounded-full bg-white dark:bg-card"
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                    </div>
                </div>
                {isLoading || data === null || figures === null ? (
                    <LoadingState />
                ) : (
                    <React.Fragment>
                        <SummaryStrip
                            total={data.totalApplicants}
                            active={figures.active}
                            hired={figures.hired}
                            attention={figures.attention}
                        />
                        <div className="grid items-stretch gap-4 lg:grid-cols-3">
                            <div className="min-w-0 lg:col-span-2">
                                <VolumeChart
                                    daily={data.volumeDaily}
                                    rangeStart={data.volumeStart}
                                    rangeEnd={data.volumeEnd}
                                    granularity={granularity}
                                    onGranularityChange={setGranularity}
                                />
                            </div>
                            <div className="min-w-0">
                                <PositionList rows={data.breakdown.applicantsByPosition} />
                            </div>
                        </div>
                        <div className="grid items-start gap-4 lg:grid-cols-3">
                            <div className="min-w-0 lg:col-span-2">
                                <StageList queues={data.queues} />
                            </div>
                            <div className="min-w-0">
                                <AttentionHighlight queues={data.queues} />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Updated {new Date(data.generatedAt).toLocaleString()} ·{" "}
                            {data.bounds.applicantRowsScanned} applicant rows scanned.
                        </p>
                    </React.Fragment>
                )}
            </div>
        </div>
    );
}
