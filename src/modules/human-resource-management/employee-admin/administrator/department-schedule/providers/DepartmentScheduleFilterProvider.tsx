/**
 * Department Schedule Filter Provider
 * Global filter state for schedule filtering
 */

"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { DepartmentScheduleFilters } from "../types";

// ============================================================================
// CONTEXT DEFINITION
// ============================================================================

interface DepartmentScheduleFilterContextType {
    filters: DepartmentScheduleFilters;
    updateSearch: (search: string) => void;
    updateFromDate: (from: Date | null) => void;
    updateToDate: (to: Date | null) => void;
    resetFilters: () => void;
}

const DepartmentScheduleFilterContext = createContext<DepartmentScheduleFilterContextType | undefined>(undefined);

// ============================================================================
// DEFAULT FILTER STATE
// ============================================================================

const DEFAULT_FILTERS: DepartmentScheduleFilters = {
    search: "",
    dateRange: {
        from: null,
        to: null,
    },
};

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function DepartmentScheduleFilterProvider({
                                                     children,
                                                 }: {
    children: React.ReactNode;
}) {
    const [filters, setFilters] = useState<DepartmentScheduleFilters>(DEFAULT_FILTERS);

    const updateSearch = useCallback((search: string) => {
        setFilters((prev) => ({ ...prev, search }));
    }, []);

    const updateFromDate = useCallback((from: Date | null) => {
        setFilters((prev) => ({
            ...prev,
            dateRange: {
                ...prev.dateRange,
                from,
            },
        }));
    }, []);

    const updateToDate = useCallback((to: Date | null) => {
        setFilters((prev) => ({
            ...prev,
            dateRange: {
                ...prev.dateRange,
                to,
            },
        }));
    }, []);


    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    const value: DepartmentScheduleFilterContextType = {
        filters,
        updateSearch,
        updateFromDate,
        updateToDate,
        resetFilters,
    };

    return (
        <DepartmentScheduleFilterContext.Provider value={value}>
            {children}
        </DepartmentScheduleFilterContext.Provider>
    );
}

// ============================================================================
// HOOK FOR CONSUMING CONTEXT
// ============================================================================

export function useDepartmentScheduleFilterContext() {
    const context = useContext(DepartmentScheduleFilterContext);
    if (!context) {
        throw new Error(
            "useDepartmentScheduleFilterContext must be used within DepartmentScheduleFilterProvider"
        );
    }
    return context;
}
