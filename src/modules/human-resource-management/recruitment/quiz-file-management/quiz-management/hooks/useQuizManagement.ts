"use client";

import { useMemo } from "react";
import type { Quiz, QuizFormData } from "../types";
import { useQuizManagementFilterContext } from "../providers/filterProvider";
import { useQuizManagementFetchContext } from "../providers/fetchProvider";

interface UseQuizManagementReturn {
    quizzes: Quiz[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createQuiz: (data: QuizFormData) => Promise<void>;
    updateQuiz: (id: number, data: QuizFormData) => Promise<void>;
    deleteQuiz: (id: number) => Promise<void>;
    archiveQuiz: (id: number) => Promise<void>;
}

export function useQuizManagement(): UseQuizManagementReturn {
    const { filters } = useQuizManagementFilterContext();
    const {
        allQuizzes,
        isLoading,
        isError,
        error,
        refetch,
        createQuiz,
        updateQuiz,
        deleteQuiz,
        archiveQuiz,
    } = useQuizManagementFetchContext();

    const quizzes = useMemo(() => {
        let result = allQuizzes;

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter(
                (q) =>
                    q.name?.toLowerCase().includes(s) ||
                    q.description?.toLowerCase().includes(s)
            );
        }

        if (filters.status != null) {
            result = result.filter((q) => q.status === filters.status);
        }

        return result;
    }, [allQuizzes, filters]);

    return {
        quizzes,
        isLoading,
        isError,
        error,
        refetch,
        createQuiz,
        updateQuiz,
        deleteQuiz,
        archiveQuiz,
    };
}
