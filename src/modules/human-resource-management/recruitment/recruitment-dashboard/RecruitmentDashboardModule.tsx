"use client";

import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, LayoutDashboard, RefreshCw } from "lucide-react";
import { useRecruitmentDashboard } from "./hooks/useRecruitmentDashboard";
import { QueueTiles } from "./components/QueueTiles";
import { VolumeChart } from "./components/VolumeChart";
import { BreakdownCards } from "./components/BreakdownCards";

function LoadingState() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                {[0, 1, 2, 3].map((key) => (
                    <Skeleton key={key} className="h-28" />
                ))}
            </div>
            <Skeleton className="h-72" />
            <Skeleton className="h-96" />
        </div>
    );
}

export default function RecruitmentDashboardModule() {
    const { data, isLoading, isError, errorMessage, reload } = useRecruitmentDashboard();

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

    return (
        <div className="p-2 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-sm border border-primary/20">
                        <LayoutDashboard className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                            Recruitment Dashboard
                        </h1>
                        <p className="text-muted-foreground/80 font-medium mt-1 text-base sm:text-lg">
                            Live work queues — every tile opens the module where HR acts on it.
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={reload}
                    disabled={isLoading}
                    className="w-full sm:w-auto"
                >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>
            {isLoading || data === null ? (
                <LoadingState />
            ) : (
                <React.Fragment>
                    <QueueTiles queues={data.queues} />
                    <VolumeChart
                        daily={data.volumeDaily}
                        rangeStart={data.volumeStart}
                        rangeEnd={data.volumeEnd}
                    />
                    <BreakdownCards data={data} />
                </React.Fragment>
            )}
        </div>
    );
}
