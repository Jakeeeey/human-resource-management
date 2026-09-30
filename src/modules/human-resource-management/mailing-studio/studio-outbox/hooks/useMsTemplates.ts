"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchMsTemplateDirectory, type MsTemplateDirectoryEntry } from "../providers/msTemplates";

export interface UseMsTemplatesResult {
    data: MsTemplateDirectoryEntry[] | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useMsTemplates(): UseMsTemplatesResult {
    const [data, setData] = useState<MsTemplateDirectoryEntry[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await fetchMsTemplateDirectory());
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refetch();
    }, [refetch]);

    return { data, isLoading, error, refetch };
}
