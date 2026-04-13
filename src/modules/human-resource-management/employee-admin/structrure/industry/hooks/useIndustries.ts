"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { IndustryWithRelations, IndustryFormData } from "../types";
import { useIndustryFilterContext } from "../providers/IndustryFilterProvider";

interface UseIndustriesReturn {
    industries: IndustryWithRelations[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createIndustry: (data: IndustryFormData) => Promise<void>;
    updateIndustry: (id: number, data: IndustryFormData) => Promise<void>;
}

export function useIndustries(): UseIndustriesReturn {
    const { filters } = useIndustryFilterContext();

    const [allIndustries, setAllIndustries] = useState<IndustryWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const hasLoadedRef = useRef(false);

    const fetchData = useCallback(async (showLoading = false) => {
        try {
            if (showLoading || !hasLoadedRef.current) {
                setIsLoading(true);
            }

            setIsError(false);
            setError(null);

            const res = await fetch(
                "/api/hrm/employee-admin/structure/industry",
                { cache: "no-store" }
            );

            if (!res.ok) {
                throw new Error(`API error: ${res.status}`);
            }

            const data = await res.json();
            setAllIndustries(data.industries || []);
            hasLoadedRef.current = true;

        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error("Unknown error"));
            console.error("Industry fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    const filteredIndustries = useMemo(() => {
        let result = allIndustries;

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter(i =>
                (i.industry_name?.toLowerCase().includes(s)) ||
                (i.industry_code?.toLowerCase().includes(s)) ||
                (i.industry_head?.toLowerCase().includes(s))
            );
        }

        return result;
    }, [allIndustries, filters.search]);

    const createIndustry = useCallback(async (data: IndustryFormData) => {
        try {
            const res = await fetch("/api/hrm/employee-admin/structure/industry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || `Server error: ${res.status}`);
            }

            await fetchData(true);
        } catch (err) {
            console.error('Create industry error:', err);
            throw err;
        }
    }, [fetchData]);

    const updateIndustry = useCallback(async (id: number, data: IndustryFormData) => {
        try {
            const res = await fetch("/api/hrm/employee-admin/structure/industry", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...data }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || `Server error: ${res.status}`);
            }

            await fetchData(true);
        } catch (err) {
            console.error('Update industry error:', err);
            throw err;
        }
    }, [fetchData]);

    return {
        industries: filteredIndustries,
        isLoading,
        isError,
        error,
        refetch: () => fetchData(true),
        createIndustry,
        updateIndustry,
    };
}
