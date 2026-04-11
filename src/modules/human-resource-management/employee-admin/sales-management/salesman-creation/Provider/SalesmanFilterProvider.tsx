/**
 * Salesman Filter Provider
 * Global filter state shared across all salesman components
 */

"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { SalesmanFilters } from "../types";

interface SalesmanFilterContextType {
    filters: SalesmanFilters;
    updateSearch: (search: string) => void;
    updatePriceType: (priceType: string) => void;
    updateIsActive: (isActive: boolean | null) => void;
    resetFilters: () => void;
}

const SalesmanFilterContext = createContext<SalesmanFilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: SalesmanFilters = {
    search: "",
    priceType: "",
    isActive: null,
};

export function SalesmanFilterProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [filters, setFilters] = useState<SalesmanFilters>(DEFAULT_FILTERS);

    const updateSearch = useCallback((search: string) => {
        setFilters((prev) => ({ ...prev, search }));
    }, []);

    const updatePriceType = useCallback((priceType: string) => {
        setFilters((prev) => ({ ...prev, priceType }));
    }, []);

    const updateIsActive = useCallback((isActive: boolean | null) => {
        setFilters((prev) => ({ ...prev, isActive }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    const value: SalesmanFilterContextType = {
        filters,
        updateSearch,
        updatePriceType,
        updateIsActive,
        resetFilters,
    };

    return (
        <SalesmanFilterContext.Provider value={value}>
            {children}
        </SalesmanFilterContext.Provider>
    );
}

export function useSalesmanFilterContext() {
    const context = useContext(SalesmanFilterContext);
    if (!context) {
        throw new Error(
            "useSalesmanFilterContext must be used within SalesmanFilterProvider"
        );
    }
    return context;
}
