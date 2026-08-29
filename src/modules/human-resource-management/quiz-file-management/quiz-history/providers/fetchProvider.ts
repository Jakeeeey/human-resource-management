"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { QuizAttempt } from "../types";

interface QuizHistoryFetchContextType {
    allAttempts: QuizAttempt[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

const QuizHistoryFetchContext = createContext<QuizHistoryFetchContextType | undefined>(undefined);

export function QuizHistoryFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [allAttempts, setAllAttempts] = useState<QuizAttempt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);

            const res = await fetch("/api/hrm/quiz-file-management/quiz-attempt", {
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
        QuizHistoryFetchContext.Provider,
        { value: { allAttempts, isLoading, isError, error, refetch: fetchData } },
        children
    );
}

export function useQuizHistoryFetchContext() {
    const ctx = useContext(QuizHistoryFetchContext);
    if (!ctx) throw new Error("Must be used inside QuizHistoryFetchProvider");
    return ctx;
}
