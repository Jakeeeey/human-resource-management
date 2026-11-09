"use client";

import React from "react";
import { AssessmentHistoryFilterProvider } from "./providers/filterProvider";
import { AssessmentHistoryFetchProvider } from "./providers/fetchProvider";
import { useAssessmentHistory } from "./hooks/useAssessmentHistory";
import { AssessmentHistoryTable } from "./components/Table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

function AssessmentHistoryModuleContent() {
    const { attempts, isLoading, isError, error, refetch } = useAssessmentHistory();

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                    <span>Failed to load assessment history: {error?.message || "Unknown error"}</span>
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-4">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Assessment History</h1>
                    <p className="text-muted-foreground">
                        All completed assessment attempts, newest first.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="w-full sm:w-auto">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <AssessmentHistoryTable data={attempts} isLoading={isLoading} />
        </div>
    );
}

export default function AssessmentHistoryModule() {
    return (
        <AssessmentHistoryFetchProvider>
            <AssessmentHistoryFilterProvider>
                <AssessmentHistoryModuleContent />
            </AssessmentHistoryFilterProvider>
        </AssessmentHistoryFetchProvider>
    );
}
