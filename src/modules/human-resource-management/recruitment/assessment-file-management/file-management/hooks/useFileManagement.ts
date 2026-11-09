"use client";

import { useMemo } from "react";
import type { AssessmentQuestionWithOptions, AssessmentQuestionFormData } from "../types";
import { useFileManagementFilterContext } from "../providers/filterProvider";
import { useFileManagementFetchContext } from "../providers/fetchProvider";

interface UseFileManagementReturn {
    questions: AssessmentQuestionWithOptions[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createQuestion: (data: AssessmentQuestionFormData) => Promise<void>;
    updateQuestion: (id: number, data: AssessmentQuestionFormData) => Promise<void>;
    deleteQuestion: (id: number) => Promise<void>;
    reactivateQuestion: (id: number) => Promise<void>;
}

export function useFileManagement(): UseFileManagementReturn {
    const { filters } = useFileManagementFilterContext();
    const {
        allQuestions,
        isLoading,
        isError,
        error,
        refetch,
        createQuestion,
        updateQuestion,
        deleteQuestion,
        reactivateQuestion,
    } = useFileManagementFetchContext();

    const questions = useMemo(() => {
        let result = allQuestions;

        if (!filters.includeInactive) {
            result = result.filter((q) => q.is_active);
        }

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter((q) =>
                q.question_text?.toLowerCase().includes(s)
            );
        }

        if (filters.questionType != null) {
            result = result.filter((q) => q.question_type === filters.questionType);
        }

        if (filters.category != null) {
            result = result.filter((q) => q.category === filters.category);
        }

        return result;
    }, [allQuestions, filters]);

    return {
        questions,
        isLoading,
        isError,
        error,
        refetch,
        createQuestion,
        updateQuestion,
        deleteQuestion,
        reactivateQuestion,
    };
}
