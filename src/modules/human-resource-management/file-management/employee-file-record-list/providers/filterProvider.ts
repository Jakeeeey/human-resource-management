"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { EmployeeFileRecordListFilters } from "../types";

interface EmployeeFileRecordListFilterContextType {
    filters: EmployeeFileRecordListFilters;
    updateSearch: (search: string) => void;
    updateRecordTypeId: (id: number | null) => void;
    updateFromDate: (date: Date | null) => void;
    updateToDate: (date: Date | null) => void;
    resetFilters: () => void;
}

const EmployeeFileRecordListFilterContext =
    createContext<EmployeeFileRecordListFilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: EmployeeFileRecordListFilters = {
    search: "",
    recordTypeId: null,
    dateRange: { from: null, to: null },
};

export function EmployeeFileRecordListFilterProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

    const updateSearch = useCallback((search: string) => {
        setFilters((p) => ({ ...p, search }));
    }, []);

    const updateRecordTypeId = useCallback((recordTypeId: number | null) => {
        setFilters((p) => ({ ...p, recordTypeId }));
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
        EmployeeFileRecordListFilterContext.Provider,
        {
            value: {
                filters,
                updateSearch,
                updateRecordTypeId,
                updateFromDate,
                updateToDate,
                resetFilters,
            },
        },
        children
    );
}

export function useEmployeeFileRecordListFilterContext() {
    const ctx = useContext(EmployeeFileRecordListFilterContext);
    if (!ctx)
        throw new Error(
            "Must be used inside EmployeeFileRecordListFilterProvider"
        );
    return ctx;
}
