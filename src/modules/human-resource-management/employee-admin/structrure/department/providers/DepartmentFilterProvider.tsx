"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { DepartmentFilters } from "../types";

interface DepartmentFilterContextType {
    filters: DepartmentFilters;
    updateSearch: (search: string) => void;
    updateFromDate: (date: Date | null) => void;
    updateToDate: (date: Date | null) => void;
    resetFilters: () => void;
}

const DepartmentFilterContext =
    createContext<DepartmentFilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: DepartmentFilters = {
    search: "",
    dateRange: { from: null, to: null },
};

export function DepartmentFilterProvider({ children }: { children: React.ReactNode }) {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

    const updateSearch = useCallback((search: string) => {
        setFilters((p) => ({ ...p, search }));
    }, []);


    const updateFromDate = useCallback((from: Date | null) => {
        setFilters((p) => ({ ...p, dateRange: { ...p.dateRange, from } }));
    }, []);

    const updateToDate = useCallback((to: Date | null) => {
        setFilters((p) => ({ ...p, dateRange: { ...p.dateRange, to } }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    const contextValue = React.useMemo(() => ({
        filters,
        updateSearch,
        updateFromDate,
        updateToDate,
        resetFilters,
    }), [filters, updateSearch, updateFromDate, updateToDate, resetFilters]);

    return (
        <DepartmentFilterContext.Provider value={contextValue}>
            {children}
        </DepartmentFilterContext.Provider>
    );

}

export function useDepartmentFilterContext() {
    const ctx = useContext(DepartmentFilterContext);
    if (!ctx) throw new Error("Must be used inside DepartmentFilterProvider");
    return ctx;
}
