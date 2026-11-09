"use client";

import { useMemo } from "react";
import type { Assessment, AssessmentFormData } from "../types";
import { useAssessmentManagementFilterContext } from "../providers/filterProvider";
import { useAssessmentManagementFetchContext } from "../providers/fetchProvider";

interface UseAssessmentManagementReturn {
    assessments: Assessment[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createAssessment: (data: AssessmentFormData) => Promise<void>;
    updateAssessment: (id: number, data: AssessmentFormData) => Promise<void>;
    deleteAssessment: (id: number) => Promise<void>;
    archiveAssessment: (id: number) => Promise<void>;
}

export function useAssessmentManagement(): UseAssessmentManagementReturn {
    const { filters } = useAssessmentManagementFilterContext();
    const {
        allAssessments,
        isLoading,
        isError,
        error,
        refetch,
        createAssessment,
        updateAssessment,
        deleteAssessment,
        archiveAssessment,
    } = useAssessmentManagementFetchContext();

    const assessments = useMemo(() => {
        let result = allAssessments;

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter(
                (q) =>
                    q.name?.toLowerCase().includes(s) ||
                    q.description?.toLowerCase().includes(s)
            );
        }

        if (filters.status != null) {
            result = result.filter((q) => q.status === filters.status);
        }

        return result;
    }, [allAssessments, filters]);

    return {
        assessments,
        isLoading,
        isError,
        error,
        refetch,
        createAssessment,
        updateAssessment,
        deleteAssessment,
        archiveAssessment,
    };
}
