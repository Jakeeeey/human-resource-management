"use client";

import { useMemo } from "react";
import type { AssessmentAttempt } from "../types";
import { useAssessmentHistoryFilterContext } from "../providers/filterProvider";
import { useAssessmentHistoryFetchContext } from "../providers/fetchProvider";

interface UseAssessmentHistoryReturn {
    attempts: AssessmentAttempt[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

export function useAssessmentHistory(): UseAssessmentHistoryReturn {
    const { filters } = useAssessmentHistoryFilterContext();
    const { allAttempts, isLoading, isError, error, refetch } = useAssessmentHistoryFetchContext();

    const attempts = useMemo(() => {
        let result = allAttempts;

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter((a) =>
                a.applicant?.full_name?.toLowerCase().includes(s)
            );
        }

        if (filters.assessmentId != null) {
            result = result.filter((a) => a.quiz_id === filters.assessmentId);
        }

        if (filters.passed != null) {
            result = result.filter((a) => a.passed === filters.passed);
        }

        return result;
    }, [allAttempts, filters]);

    return { attempts, isLoading, isError, error, refetch };
}
