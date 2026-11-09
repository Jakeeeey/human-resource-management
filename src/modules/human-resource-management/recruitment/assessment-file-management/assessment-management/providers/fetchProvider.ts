"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Assessment, AssessmentFormData } from "../types";

interface AssessmentManagementFetchContextType {
    allAssessments: Assessment[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createAssessment: (data: AssessmentFormData) => Promise<void>;
    updateAssessment: (id: number, data: AssessmentFormData) => Promise<void>;
    deleteAssessment: (id: number) => Promise<void>;
    archiveAssessment: (id: number) => Promise<void>;
}

const AssessmentManagementFetchContext =
    createContext<AssessmentManagementFetchContextType | undefined>(undefined);

export function AssessmentManagementFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [allAssessments, setAllAssessments] = useState<Assessment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);

            const res = await fetch(
                "/api/hrm/recruitment/assessment-file-management/assessment-management",
                { cache: "no-store" }
            );

            if (!res.ok) throw new Error("Fetch failed");

            const data = await res.json();
            setAllAssessments(data.assessments || []);
        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const createAssessment = useCallback(
        async (data: AssessmentFormData) => {
            const res = await fetch(
                "/api/hrm/recruitment/assessment-file-management/assessment-management",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                }
            );
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || "Create failed");
            }
            await fetchData();
        },
        [fetchData]
    );

    const updateAssessment = useCallback(
        async (id: number, data: AssessmentFormData) => {
            const res = await fetch(
                "/api/hrm/recruitment/assessment-file-management/assessment-management",
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id, ...data }),
                }
            );
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || "Update failed");
            }
            await fetchData();
        },
        [fetchData]
    );

    const deleteAssessment = useCallback(
        async (id: number) => {
            const res = await fetch(
                `/api/hrm/recruitment/assessment-file-management/assessment-management?id=${id}`,
                { method: "DELETE" }
            );
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || "Delete failed");
            }
            await fetchData();
        },
        [fetchData]
    );

    const archiveAssessment = useCallback(
        async (id: number) => {
            const res = await fetch(
                "/api/hrm/recruitment/assessment-file-management/assessment-management",
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id, status: "archived" }),
                }
            );
            if (!res.ok) throw new Error("Archive failed");
            await fetchData();
        },
        [fetchData]
    );

    return React.createElement(
        AssessmentManagementFetchContext.Provider,
        {
            value: {
                allAssessments,
                isLoading,
                isError,
                error,
                refetch: fetchData,
                createAssessment,
                updateAssessment,
                deleteAssessment,
                archiveAssessment,
            },
        },
        children
    );
}

export function useAssessmentManagementFetchContext() {
    const ctx = useContext(AssessmentManagementFetchContext);
    if (!ctx)
        throw new Error("Must be used inside AssessmentManagementFetchProvider");
    return ctx;
}
