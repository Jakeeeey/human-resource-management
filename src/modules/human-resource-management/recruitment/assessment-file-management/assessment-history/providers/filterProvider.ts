"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { AssessmentHistoryFilters } from "../types";

interface AssessmentHistoryFilterContextType {
    filters: AssessmentHistoryFilters;
    updateSearch: (search: string) => void;
    updateAssessmentId: (assessmentId: number | null) => void;
    updatePassed: (passed: boolean | null) => void;
    resetFilters: () => void;
}

const AssessmentHistoryFilterContext = createContext<AssessmentHistoryFilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: AssessmentHistoryFilters = {
    search: "",
    assessmentId: null,
    passed: null,
};

export function AssessmentHistoryFilterProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

    const updateSearch = useCallback((search: string) => {
        setFilters((p) => ({ ...p, search }));
    }, []);

    const updateAssessmentId = useCallback((assessmentId: number | null) => {
        setFilters((p) => ({ ...p, assessmentId }));
    }, []);

    const updatePassed = useCallback((passed: boolean | null) => {
        setFilters((p) => ({ ...p, passed }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    return React.createElement(
        AssessmentHistoryFilterContext.Provider,
        { value: { filters, updateSearch, updateAssessmentId, updatePassed, resetFilters } },
        children
    );
}

export function useAssessmentHistoryFilterContext() {
    const ctx = useContext(AssessmentHistoryFilterContext);
    if (!ctx) throw new Error("Must be used inside AssessmentHistoryFilterProvider");
    return ctx;
}
