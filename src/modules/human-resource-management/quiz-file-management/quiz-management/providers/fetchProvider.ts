"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Quiz, QuizFormData } from "../types";

interface QuizManagementFetchContextType {
    allQuizzes: Quiz[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createQuiz: (data: QuizFormData) => Promise<void>;
    updateQuiz: (id: number, data: QuizFormData) => Promise<void>;
    deleteQuiz: (id: number) => Promise<void>;
    archiveQuiz: (id: number) => Promise<void>;
}

const QuizManagementFetchContext =
    createContext<QuizManagementFetchContextType | undefined>(undefined);

export function QuizManagementFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);

            const res = await fetch(
                "/api/hrm/quiz-file-management/quiz-management",
                { cache: "no-store" }
            );

            if (!res.ok) throw new Error("Fetch failed");

            const data = await res.json();
            setAllQuizzes(data.quizzes || []);
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

    const createQuiz = useCallback(
        async (data: QuizFormData) => {
            const res = await fetch(
                "/api/hrm/quiz-file-management/quiz-management",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                }
            );
            if (!res.ok) throw new Error("Create failed");
            await fetchData();
        },
        [fetchData]
    );

    const updateQuiz = useCallback(
        async (id: number, data: QuizFormData) => {
            const res = await fetch(
                "/api/hrm/quiz-file-management/quiz-management",
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id, ...data }),
                }
            );
            if (!res.ok) throw new Error("Update failed");
            await fetchData();
        },
        [fetchData]
    );

    const deleteQuiz = useCallback(
        async (id: number) => {
            const res = await fetch(
                `/api/hrm/quiz-file-management/quiz-management?id=${id}`,
                { method: "DELETE" }
            );
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || "Delete failed");
            }
            await fetchData();
        },
        [fetchData]
    );

    const archiveQuiz = useCallback(
        async (id: number) => {
            const res = await fetch(
                "/api/hrm/quiz-file-management/quiz-management",
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id, status: "archived" }),
                }
            );
            if (!res.ok) throw new Error("Archive failed");
            await fetchData();
        },
        [fetchData]
    );

    return React.createElement(
        QuizManagementFetchContext.Provider,
        {
            value: {
                allQuizzes,
                isLoading,
                isError,
                error,
                refetch: fetchData,
                createQuiz,
                updateQuiz,
                deleteQuiz,
                archiveQuiz,
            },
        },
        children
    );
}

export function useQuizManagementFetchContext() {
    const ctx = useContext(QuizManagementFetchContext);
    if (!ctx)
        throw new Error("Must be used inside QuizManagementFetchProvider");
    return ctx;
}
