"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { QuizManagementFilters, QuizStatus } from "../types";

interface QuizManagementFilterContextType {
    filters: QuizManagementFilters;
    updateSearch: (search: string) => void;
    updateStatus: (status: QuizStatus | null) => void;
    resetFilters: () => void;
}

const QuizManagementFilterContext =
    createContext<QuizManagementFilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: QuizManagementFilters = {
    search: "",
    status: null,
};

export function QuizManagementFilterProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

    const updateSearch = useCallback((search: string) => {
        setFilters((p) => ({ ...p, search }));
    }, []);

    const updateStatus = useCallback((status: QuizStatus | null) => {
        setFilters((p) => ({ ...p, status }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    return React.createElement(
        QuizManagementFilterContext.Provider,
        { value: { filters, updateSearch, updateStatus, resetFilters } },
        children
    );
}

export function useQuizManagementFilterContext() {
    const ctx = useContext(QuizManagementFilterContext);
    if (!ctx)
        throw new Error("Must be used inside QuizManagementFilterProvider");
    return ctx;
}
