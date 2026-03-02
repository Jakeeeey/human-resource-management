"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { EmployeeFileRecordTypeFilters } from "../types";

interface EmployeeFileRecordTypeFilterContextType {
    filters: EmployeeFileRecordTypeFilters;
    updateSearch: (search: string) => void;
    updateFromDate: (date: Date | null) => void;
    updateToDate: (date: Date | null) => void;
    resetFilters: () => void;
}

const EmployeeFileRecordTypeFilterContext =
    createContext<EmployeeFileRecordTypeFilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: EmployeeFileRecordTypeFilters = {
    search: "",
    dateRange: { from: null, to: null },
};

export function EmployeeFileRecordTypeFilterProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
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

    return React.createElement(
        EmployeeFileRecordTypeFilterContext.Provider,
        { value: { filters, updateSearch, updateFromDate, updateToDate, resetFilters } },
        children
    );
}

export function useEmployeeFileRecordTypeFilterContext() {
    const ctx = useContext(EmployeeFileRecordTypeFilterContext);
    if (!ctx)
        throw new Error(
            "Must be used inside EmployeeFileRecordTypeFilterProvider"
        );
    return ctx;
}
