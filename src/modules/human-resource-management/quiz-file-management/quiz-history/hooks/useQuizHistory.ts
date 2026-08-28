"use client";

import { useMemo } from "react";
import type { QuizAttempt } from "../types";
import { useQuizHistoryFilterContext } from "../providers/filterProvider";
import { useQuizHistoryFetchContext } from "../providers/fetchProvider";

interface UseQuizHistoryReturn {
    attempts: QuizAttempt[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

export function useQuizHistory(): UseQuizHistoryReturn {
    const { filters } = useQuizHistoryFilterContext();
    const { allAttempts, isLoading, isError, error, refetch } = useQuizHistoryFetchContext();

    const attempts = useMemo(() => {
        let result = allAttempts;

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter((a) =>
                a.applicant?.full_name?.toLowerCase().includes(s)
            );
        }

        if (filters.quizId != null) {
            result = result.filter((a) => a.quiz_id === filters.quizId);
        }

        if (filters.passed != null) {
            result = result.filter((a) => a.passed === filters.passed);
        }

        return result;
    }, [allAttempts, filters]);

    return { attempts, isLoading, isError, error, refetch };
}
