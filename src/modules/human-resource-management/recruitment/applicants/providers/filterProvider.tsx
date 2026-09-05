"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { ApplicantFilters } from "../types";
import type { APPLICANT_STAGE } from "../lib/deriveApplicantStage";

type ApplicantStage = (typeof APPLICANT_STAGE)[number];

interface ApplicantFilterContextType {
    filters: ApplicantFilters;
    updateSearch: (search: string) => void;
    updateStage: (stage: ApplicantStage | null) => void;
    resetFilters: () => void;
}

const ApplicantFilterContext = createContext<ApplicantFilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: ApplicantFilters = {
    search: "",
    stage: null,
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

    const updateStage = useCallback((stage: ApplicantStage | null) => {
        setFilters((p) => ({ ...p, stage }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    return React.createElement(
        ApplicantFilterContext.Provider,
        { value: { filters, updateSearch, updateStage, resetFilters } },
        children
    );
}

export function useApplicantFilterContext() {
    const ctx = useContext(ApplicantFilterContext);
    if (!ctx) throw new Error("Must be used inside ApplicantFilterProvider");
    return ctx;
}
