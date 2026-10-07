"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { QuizHistoryFilters } from "../types";

interface QuizHistoryFilterContextType {
    filters: QuizHistoryFilters;
    updateSearch: (search: string) => void;
    updateQuizId: (quizId: number | null) => void;
    updatePassed: (passed: boolean | null) => void;
    resetFilters: () => void;
}

const QuizHistoryFilterContext = createContext<QuizHistoryFilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: QuizHistoryFilters = {
    search: "",
    quizId: null,
    passed: null,
};

export function QuizHistoryFilterProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

    const updateSearch = useCallback((search: string) => {
        setFilters((p) => ({ ...p, search }));
    }, []);

    const updateQuizId = useCallback((quizId: number | null) => {
        setFilters((p) => ({ ...p, quizId }));
    }, []);

    const updatePassed = useCallback((passed: boolean | null) => {
        setFilters((p) => ({ ...p, passed }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    return React.createElement(
        QuizHistoryFilterContext.Provider,
        { value: { filters, updateSearch, updateQuizId, updatePassed, resetFilters } },
        children
    );
}

export function useQuizHistoryFilterContext() {
    const ctx = useContext(QuizHistoryFilterContext);
    if (!ctx) throw new Error("Must be used inside QuizHistoryFilterProvider");
    return ctx;
}
