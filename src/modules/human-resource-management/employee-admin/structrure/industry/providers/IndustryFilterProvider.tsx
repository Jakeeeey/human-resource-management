"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { IndustryFilters } from "../types";

interface IndustryFilterContextType {
    filters: IndustryFilters;
    setSearch: (search: string) => void;
    resetFilters: () => void;
    isFiltering: boolean;
}

const IndustryFilterContext = createContext<IndustryFilterContextType | undefined>(undefined);

export function IndustryFilterProvider({ children }: { children: React.ReactNode }) {
    const [filters, setFilters] = useState<IndustryFilters>({
        search: "",
    });

    const setSearch = useCallback((search: string) => {
        setFilters(prev => ({ ...prev, search }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters({ search: "" });
    }, []);

    const isFiltering = useMemo(() => filters.search.length > 0, [filters.search]);

    const value = useMemo(() => ({
        filters,
        setSearch,
        resetFilters,
        isFiltering,
    }), [filters, setSearch, resetFilters, isFiltering]);

    return (
        <IndustryFilterContext.Provider value={value}>
            {children}
        </IndustryFilterContext.Provider>
    );
}

export function useIndustryFilterContext() {
    const context = useContext(IndustryFilterContext);
    if (!context) {
        throw new Error("useIndustryFilterContext must be used within an IndustryFilterProvider");
    }
    return context;
}
