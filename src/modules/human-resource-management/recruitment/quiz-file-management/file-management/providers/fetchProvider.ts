"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { QuizQuestionWithOptions, QuizQuestionFormData } from "../types";

interface FileManagementFetchContextType {
    allQuestions: QuizQuestionWithOptions[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createQuestion: (data: QuizQuestionFormData) => Promise<void>;
    updateQuestion: (id: number, data: QuizQuestionFormData) => Promise<void>;
    deleteQuestion: (id: number) => Promise<void>;
    reactivateQuestion: (id: number) => Promise<void>;
}

const FileManagementFetchContext =
    createContext<FileManagementFetchContextType | undefined>(undefined);

export function FileManagementFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [allQuestions, setAllQuestions] = useState<QuizQuestionWithOptions[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);

            const res = await fetch(
                "/api/hrm/quiz-file-management/file-management?includeInactive=true",
                { cache: "no-store" }
            );

            if (!res.ok) throw new Error("Fetch failed");

            const data = await res.json();
            setAllQuestions(data.questions || []);
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

    const createQuestion = useCallback(
        async (data: QuizQuestionFormData) => {
            const res = await fetch(
                "/api/hrm/quiz-file-management/file-management",
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

    const updateQuestion = useCallback(
        async (id: number, data: QuizQuestionFormData) => {
            const res = await fetch(
                "/api/hrm/quiz-file-management/file-management",
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

    const deleteQuestion = useCallback(
        async (id: number) => {
            const res = await fetch(
                `/api/hrm/quiz-file-management/file-management?id=${id}`,
                { method: "DELETE" }
            );
            if (!res.ok) throw new Error("Delete failed");
            await fetchData();
        },
        [fetchData]
    );

    const reactivateQuestion = useCallback(
        async (id: number) => {
            const res = await fetch(
                "/api/hrm/quiz-file-management/file-management",
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id, is_active: true }),
                }
            );
            if (!res.ok) throw new Error("Reactivate failed");
            await fetchData();
        },
        [fetchData]
    );

    return React.createElement(
        FileManagementFetchContext.Provider,
        {
            value: {
                allQuestions,
                isLoading,
                isError,
                error,
                refetch: fetchData,
                createQuestion,
                updateQuestion,
                deleteQuestion,
                reactivateQuestion,
            },
        },
        children
    );
}

export function useFileManagementFetchContext() {
    const ctx = useContext(FileManagementFetchContext);
    if (!ctx)
        throw new Error("Must be used inside FileManagementFetchProvider");
    return ctx;
}
