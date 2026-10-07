"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { FileManagementFilters, QuestionType } from "../types";

interface FileManagementFilterContextType {
    filters: FileManagementFilters;
    updateSearch: (search: string) => void;
    updateQuestionType: (type: QuestionType | null) => void;
    updateCategory: (category: string | null) => void;
    updateIncludeInactive: (includeInactive: boolean) => void;
    resetFilters: () => void;
}

const FileManagementFilterContext =
    createContext<FileManagementFilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: FileManagementFilters = {
    search: "",
    questionType: null,
    category: null,
    includeInactive: false,
};

export function FileManagementFilterProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

    const updateSearch = useCallback((search: string) => {
        setFilters((p) => ({ ...p, search }));
    }, []);

    const updateQuestionType = useCallback((questionType: QuestionType | null) => {
        setFilters((p) => ({ ...p, questionType }));
    }, []);

    const updateCategory = useCallback((category: string | null) => {
        setFilters((p) => ({ ...p, category }));
    }, []);

    const updateIncludeInactive = useCallback((includeInactive: boolean) => {
        setFilters((p) => ({ ...p, includeInactive }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    return React.createElement(
        FileManagementFilterContext.Provider,
        {
            value: {
                filters,
                updateSearch,
                updateQuestionType,
                updateCategory,
                updateIncludeInactive,
                resetFilters,
            },
        },
        children
    );
}

export function useFileManagementFilterContext() {
    const ctx = useContext(FileManagementFilterContext);
    if (!ctx)
        throw new Error("Must be used inside FileManagementFilterProvider");
    return ctx;
}
