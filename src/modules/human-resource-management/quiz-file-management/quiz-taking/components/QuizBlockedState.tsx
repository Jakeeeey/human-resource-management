"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type QuizBlockedVariant = "start" | "submit";

interface QuizBlockedStateProps {
    variant: QuizBlockedVariant;
    message: string;
    onRetry: () => void;
    onBack: () => void;
    backLabel?: string;
}

// Copy differs by failure kind: a start failure is retried from scratch, while a
// submit failure must reassure the applicant their in-progress answers survive.
const BLOCKED_COPY: Record<QuizBlockedVariant, { title: string; retryLabel: string }> = {
    start: { title: "Can't Start Quiz", retryLabel: "Try again" },
    submit: { title: "Couldn't Submit Quiz", retryLabel: "Retry submit" },
};

/**
 * Truthful terminal state for a quiz that could not start or submit — offers a
 * context-aware retry and an exit whose label matches where it actually goes.
 */
export function QuizBlockedState({
    variant,
    message,
    onRetry,
    onBack,
    backLabel = "Back",
}: QuizBlockedStateProps) {
    const { title, retryLabel } = BLOCKED_COPY[variant];
    return (
        <div className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col justify-center gap-4 py-8">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{title}</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
            </Alert>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="w-full sm:flex-1" onClick={onRetry}>
                    {retryLabel}
                </Button>
                <Button variant="secondary" className="w-full sm:flex-1" onClick={onBack}>
                    {backLabel}
                </Button>
            </div>
        </div>
    );
}
