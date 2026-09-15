"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { ApplicantFilters, ApplicantStatus } from "../types";

interface ApplicantFilterContextType {
    filters: ApplicantFilters;
    updateSearch: (search: string) => void;
    updateStatus: (status: ApplicantStatus | null) => void;
    resetFilters: () => void;
}

const ApplicantFilterContext = createContext<ApplicantFilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: ApplicantFilters = {
    search: "",
    status: null,
};

export function ApplicantFilterProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

    const updateSearch = useCallback((search: string) => {
        setFilters((p) => ({ ...p, search }));
    }, []);

    const updateStatus = useCallback((status: ApplicantStatus | null) => {
        setFilters((p) => ({ ...p, status }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    return React.createElement(
        ApplicantFilterContext.Provider,
        { value: { filters, updateSearch, updateStatus, resetFilters } },
        children
    );
}

export function useApplicantFilterContext() {
    const ctx = useContext(ApplicantFilterContext);
    if (!ctx) throw new Error("Must be used inside ApplicantFilterProvider");
    return ctx;
}
