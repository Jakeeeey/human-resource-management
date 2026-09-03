"use client";

import { useMemo } from "react";
import type { Template, TemplateFormData } from "../types";
import { useTemplateFilterContext } from "../providers/filterProvider";
import { useTemplateFetchContext } from "../providers/fetchProvider";

interface UseInterviewCriteriaTemplatesReturn {
    templates: Template[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createTemplate: (data: TemplateFormData) => Promise<void>;
    updateTemplate: (id: number, data: TemplateFormData) => Promise<void>;
    deleteTemplate: (id: number) => Promise<void>;
    archiveTemplate: (id: number) => Promise<void>;
}

export function useInterviewCriteriaTemplates(): UseInterviewCriteriaTemplatesReturn {
    const { filters } = useTemplateFilterContext();
    const {
        allTemplates,
        isLoading,
        isError,
        error,
        refetch,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        archiveTemplate,
    } = useTemplateFetchContext();

    const templates = useMemo(() => {
        let result = allTemplates;

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter((t) => t.name?.toLowerCase().includes(s));
        }

        if (filters.stage != null) {
            result = result.filter((t) => t.stage === filters.stage);
        }

        if (filters.status != null) {
            result = result.filter((t) => t.status === filters.status);
        }

        return result;
    }, [allTemplates, filters]);

    return {
        templates,
        isLoading,
        isError,
        error,
        refetch,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        archiveTemplate,
    };
}
