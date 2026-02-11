"use client";

import React, { createContext, useContext, useState } from "react";

interface DivisionFilters {
    search: string;
    dateRange: {
        from: Date | null;
        to: Date | null;
    };
}

interface DivisionFilterContextValue {
    filters: DivisionFilters;
    updateSearch: (v: string) => void;
    updateFromDate: (d: Date | null) => void;
    updateToDate: (d: Date | null) => void;
    reset: () => void;
}

const DivisionFilterContext =
    createContext<DivisionFilterContextValue | null>(null);

export function DivisionFilterProvider({
                                           children,
                                       }: {
    children: React.ReactNode;
}) {
    const [filters, setFilters] = useState<DivisionFilters>({
        search: "",
        dateRange: { from: null, to: null },
    });

    const updateSearch = (search: string) =>
        setFilters((f) => ({ ...f, search }));

    const updateFromDate = (from: Date | null) =>
        setFilters((f) => ({
            ...f,
            dateRange: { ...f.dateRange, from },
        }));

    const updateToDate = (to: Date | null) =>
        setFilters((f) => ({
            ...f,
            dateRange: { ...f.dateRange, to },
        }));

    const reset = () =>
        setFilters({
            search: "",
            dateRange: { from: null, to: null },
        });

    return (
        <DivisionFilterContext.Provider
            value={{
        filters,
            updateSearch,
            updateFromDate,
            updateToDate,
            reset,
    }}
>
    {children}
    </DivisionFilterContext.Provider>
);
}

export function useDivisionFilters() {
    const ctx = useContext(DivisionFilterContext);
    if (!ctx) {
        throw new Error(
            "useDivisionFilters must be used inside DivisionFilterProvider"
        );
    }
    return ctx;
}
