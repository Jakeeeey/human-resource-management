"use client";

import React from "react";
import { QuizHistoryFilterProvider } from "./providers/filterProvider";
import { QuizHistoryFetchProvider } from "./providers/fetchProvider";
import { useQuizHistory } from "./hooks/useQuizHistory";
import { QuizHistoryTable } from "./components/Table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

function QuizHistoryModuleContent() {
    const { attempts, isLoading, isError, error, refetch } = useQuizHistory();

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                    <span>Failed to load quiz history: {error?.message || "Unknown error"}</span>
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
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Quiz History</h1>
                    <p className="text-muted-foreground">
                        Every completed quiz-taking attempt, permanent and unfiltered by role
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="w-full sm:w-auto">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <QuizHistoryTable data={attempts} isLoading={isLoading} />
        </div>
    );
}

export default function QuizHistoryModule() {
    return (
        <QuizHistoryFetchProvider>
            <QuizHistoryFilterProvider>
                <QuizHistoryModuleContent />
            </QuizHistoryFilterProvider>
        </QuizHistoryFetchProvider>
    );
}
