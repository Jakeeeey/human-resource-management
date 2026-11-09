"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { AssessmentManagementFilters, AssessmentStatus } from "../types";

interface AssessmentManagementFilterContextType {
    filters: AssessmentManagementFilters;
    updateSearch: (search: string) => void;
    updateStatus: (status: AssessmentStatus | null) => void;
    resetFilters: () => void;
}

const AssessmentManagementFilterContext =
    createContext<AssessmentManagementFilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: AssessmentManagementFilters = {
    search: "",
    status: null,
};

export function AssessmentManagementFilterProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

    const updateSearch = useCallback((search: string) => {
        setFilters((p) => ({ ...p, search }));
    }, []);

    const updateStatus = useCallback((status: AssessmentStatus | null) => {
        setFilters((p) => ({ ...p, status }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    return React.createElement(
        AssessmentManagementFilterContext.Provider,
        { value: { filters, updateSearch, updateStatus, resetFilters } },
        children
    );
}

export function useAssessmentManagementFilterContext() {
    const ctx = useContext(AssessmentManagementFilterContext);
    if (!ctx)
        throw new Error("Must be used inside AssessmentManagementFilterProvider");
    return ctx;
}
