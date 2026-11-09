"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { AssessmentAttempt } from "../types";

interface AssessmentHistoryFetchContextType {
    allAttempts: AssessmentAttempt[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

const AssessmentHistoryFetchContext = createContext<AssessmentHistoryFetchContextType | undefined>(undefined);

export function AssessmentHistoryFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [allAttempts, setAllAttempts] = useState<AssessmentAttempt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);

            const res = await fetch("/api/hrm/recruitment/assessment-file-management/assessment-attempt", {
                cache: "no-store",
            });

            if (!res.ok) throw new Error("Fetch failed");

            const data = await res.json();
            setAllAttempts(data.attempts || []);
        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return React.createElement(
        AssessmentHistoryFetchContext.Provider,
        { value: { allAttempts, isLoading, isError, error, refetch: fetchData } },
        children
    );
}

export function useAssessmentHistoryFetchContext() {
    const ctx = useContext(AssessmentHistoryFetchContext);
    if (!ctx) throw new Error("Must be used inside AssessmentHistoryFetchProvider");
    return ctx;
}
