"use client";

import { useCallback, useMemo } from "react";
import { useOperationFilterContext } from "../providers/OperationFilterProvider";

export function useOperationFilters() {
    const { filters, setFilters, resetFilters } = useOperationFilterContext();

    const setSearch = useCallback((search: string) => {
        setFilters((prev) => {
            if (prev.search === search) return prev;
            return { ...prev, search };
        });
    }, [setFilters]);

    return useMemo(() => ({
        filters,
        setSearch,
        resetFilters,
    }), [filters, setSearch, resetFilters]);
}
