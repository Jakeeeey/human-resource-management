"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Template, TemplateFormData } from "../types";

interface TemplateFetchContextType {
    allTemplates: Template[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createTemplate: (data: TemplateFormData) => Promise<void>;
    updateTemplate: (id: number, data: TemplateFormData) => Promise<void>;
    deleteTemplate: (id: number) => Promise<void>;
    archiveTemplate: (id: number) => Promise<void>;
}

const TemplateFetchContext =
    createContext<TemplateFetchContextType | undefined>(undefined);

export function TemplateFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [allTemplates, setAllTemplates] = useState<Template[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);

            const res = await fetch(
                "/api/hrm/interview-criteria/templates",
                { cache: "no-store" }
            );

            if (!res.ok) throw new Error("Fetch failed");

            const data = await res.json();
            setAllTemplates(data.templates || []);
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

    const createTemplate = useCallback(
        async (data: TemplateFormData) => {
            const res = await fetch("/api/hrm/interview-criteria/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || "Create failed");
            }
            await fetchData();
        },
        [fetchData]
    );

    const updateTemplate = useCallback(
        async (id: number, data: TemplateFormData) => {
            const res = await fetch("/api/hrm/interview-criteria/templates", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...data }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || "Update failed");
            }
            await fetchData();
        },
        [fetchData]
    );

    const deleteTemplate = useCallback(
        async (id: number) => {
            const res = await fetch(
                `/api/hrm/interview-criteria/templates?id=${id}`,
                { method: "DELETE" }
            );
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                const err = new Error(data?.error || "Delete failed") as Error & {
                    hasScoreSheets?: boolean;
                };
                err.hasScoreSheets = data?.hasScoreSheets;
                throw err;
            }
            await fetchData();
        },
        [fetchData]
    );

    const archiveTemplate = useCallback(
        async (id: number) => {
            const res = await fetch("/api/hrm/interview-criteria/templates", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status: "archived" }),
            });
            if (!res.ok) throw new Error("Archive failed");
            await fetchData();
        },
        [fetchData]
    );

    return React.createElement(
        TemplateFetchContext.Provider,
        {
            value: {
                allTemplates,
                isLoading,
                isError,
                error,
                refetch: fetchData,
                createTemplate,
                updateTemplate,
                deleteTemplate,
                archiveTemplate,
            },
        },
        children
    );
}

export function useTemplateFetchContext() {
    const ctx = useContext(TemplateFetchContext);
    if (!ctx)
        throw new Error("Must be used inside TemplateFetchProvider");
    return ctx;
}
