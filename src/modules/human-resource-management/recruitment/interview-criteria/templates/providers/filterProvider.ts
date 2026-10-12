"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { TemplateFilters, Stage, TemplateStatus } from "../types";

interface TemplateFilterContextType {
    filters: TemplateFilters;
    updateSearch: (search: string) => void;
    updateStage: (stage: Stage | null) => void;
    updateStatus: (status: TemplateStatus | null) => void;
    resetFilters: () => void;
}

const TemplateFilterContext =
    createContext<TemplateFilterContextType | undefined>(undefined);

const DEFAULT_FILTERS: TemplateFilters = {
    search: "",
    stage: null,
    status: null,
};

export function TemplateFilterProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

    const updateSearch = useCallback((search: string) => {
        setFilters((p) => ({ ...p, search }));
    }, []);

    const updateStage = useCallback((stage: Stage | null) => {
        setFilters((p) => ({ ...p, stage }));
    }, []);

    const updateStatus = useCallback((status: TemplateStatus | null) => {
        setFilters((p) => ({ ...p, status }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_FILTERS);
    }, []);

    return React.createElement(
        TemplateFilterContext.Provider,
        { value: { filters, updateSearch, updateStage, updateStatus, resetFilters } },
        children
    );
}

export function useTemplateFilterContext() {
    const ctx = useContext(TemplateFilterContext);
    if (!ctx)
        throw new Error("Must be used inside TemplateFilterProvider");
    return ctx;
}
