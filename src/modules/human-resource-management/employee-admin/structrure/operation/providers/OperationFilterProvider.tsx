"use client";

import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import type { OperationFilters } from "../types";

interface OperationFilterContextType {
    filters: OperationFilters;
    setFilters: React.Dispatch<React.SetStateAction<OperationFilters>>;
    resetFilters: () => void;
}

const OperationFilterContext = createContext<OperationFilterContextType | undefined>(undefined);

const initialFilters: OperationFilters = {
    search: "",
};

export function OperationFilterProvider({ children }: { children: React.ReactNode }) {
    const [filters, setFilters] = useState<OperationFilters>(initialFilters);

    const resetFilters = useCallback(() => setFilters(initialFilters), []);

    const value = useMemo(() => ({
        filters,
        setFilters,
        resetFilters,
    }), [filters, resetFilters]);

    return (
        <OperationFilterContext.Provider value={value}>
            {children}
        </OperationFilterContext.Provider>
    );
}

export function useOperationFilterContext() {
    const context = useContext(OperationFilterContext);
    if (!context) {
        throw new Error("useOperationFilterContext must be used within an OperationFilterProvider");
    }
    return context;
}
