/**
 * Division Filter Provider
 * Global filter state shared across all division components
 */

"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { DivisionFilters } from "../types";

// ============================================================================
// CONTEXT DEFINITION
// ============================================================================

interface DivisionFilterContextType {
    filters: DivisionFilters;
    updateSearch: (search: string) => void;
    updateDateRange: (from: Date | null, to: Date | null) => void;
    resetFilters: () => void;
}

const DivisionFilterContext = createContext<DivisionFilterContextType | undefined>(undefined);

// ============================================================================
// DEFAULT FILTER STATE
// ============================================================================

const DEFAULT_FILTERS: DivisionFilters = {
    search: "",
    dateRange: {
        from: null,
        to: null,
    },
};

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function DivisionFilterProvider({
                                           children,
                                       }: {
    children: React.ReactNode;
}) {
    const [filters, setFilters] = useState<DivisionFilters>(DEFAULT_FILTERS);

    const updateSearch = useCallback((search: string) => {
        setFilters((prev) => ({ ...prev, search }));
    }, []);

    const updateDateRange = useCallback((from: Date | null, to: Date | null) => {
        setFilters((prev) => ({
            ...prev,
            dateRange: { from, to },
        }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    const value: DivisionFilterContextType = {
        filters,
        updateSearch,
        updateDateRange,
        resetFilters,
    };

    return (
        <DivisionFilterContext.Provider value={value}>
            {children}
        </DivisionFilterContext.Provider>
    );
}

// ============================================================================
// HOOK FOR CONSUMING CONTEXT
// ============================================================================

export function useDivisionFilterContext() {
    const context = useContext(DivisionFilterContext);
    if (!context) {
        throw new Error(
            "useDivisionFilterContext must be used within DivisionFilterProvider"
        );
    }
    return context;
}
