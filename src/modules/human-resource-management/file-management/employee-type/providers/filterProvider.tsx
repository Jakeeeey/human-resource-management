"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import type { EmployeeTypeFilters } from "../types";

interface EmployeeTypeFilterContextValue {
    filters: EmployeeTypeFilters;
    setFilters: React.Dispatch<React.SetStateAction<EmployeeTypeFilters>>;
    resetFilters: () => void;
}

const defaultFilters: EmployeeTypeFilters = {
    search: "",
    type_name: "",
};

const EmployeeTypeFilterContext = createContext<EmployeeTypeFilterContextValue | undefined>(undefined);

export function EmployeeTypeFilterProvider({ children }: { children: ReactNode }) {
    const [filters, setFilters] = useState<EmployeeTypeFilters>(defaultFilters);

    const resetFilters = () => setFilters(defaultFilters);

    return (
        <EmployeeTypeFilterContext.Provider value={{ filters, setFilters, resetFilters }}>
            {children}
        </EmployeeTypeFilterContext.Provider>
    );
}

export function useEmployeeTypeFilterContext() {
    const context = useContext(EmployeeTypeFilterContext);
    if (context === undefined) {
        throw new Error("useEmployeeTypeFilterContext must be used within an EmployeeTypeFilterProvider");
    }
    return context;
}
