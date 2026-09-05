"use client";

import { useMemo } from "react";
import type { ApplicantRow } from "../types";
import { useApplicantFilterContext } from "../providers/filterProvider";
import { useApplicantFetchContext } from "../providers/fetchProvider";

interface UseApplicantsReturn {
    applicants: ApplicantRow[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    refresh: () => Promise<void>;
}

export function useApplicants(): UseApplicantsReturn {
    const { filters } = useApplicantFilterContext();
    const { allApplicants, isLoading, isError, error, refetch, refresh } =
        useApplicantFetchContext();

    const applicants = useMemo(() => {
        let result = allApplicants;

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter((a) => a.full_name?.toLowerCase().includes(s));
        }

        if (filters.stage != null) {
            result = result.filter((a) => a.stage === filters.stage);
        }

        return result;
    }, [allApplicants, filters]);

    return { applicants, isLoading, isError, error, refetch, refresh };
}
