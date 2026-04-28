"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { EmploymentStatusFilters } from "../types";

interface EmploymentStatusFilterContextType {
    filters: EmploymentStatusFilters;
    updateSearch: (search: string) => void;
    updateName: (name: string) => void;
    updateFromDate: (date: Date | null) => void;
    updateToDate: (date: Date | null) => void;
    resetFilters: () => void;
}

const EmploymentStatusFilterContext =
    createContext<EmploymentStatusFilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: EmploymentStatusFilters = {
    search: "",
    name: "",
    dateRange: { from: null, to: null },
};

export function EmploymentStatusFilterProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

    const updateSearch = useCallback((search: string) => {
        setFilters((p) => ({ ...p, search }));
    }, []);

    const updateName = useCallback((name: string) => {
        setFilters((p) => ({ ...p, name }));
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

    return React.createElement(
        EmploymentStatusFilterContext.Provider,
        { value: { filters, updateSearch, updateName, updateFromDate, updateToDate, resetFilters } },
        children
    );
}

export function useEmploymentStatusFilterContext() {
    const ctx = useContext(EmploymentStatusFilterContext);
    if (!ctx)
        throw new Error("Must be used inside EmploymentStatusFilterProvider");
    return ctx;
}
