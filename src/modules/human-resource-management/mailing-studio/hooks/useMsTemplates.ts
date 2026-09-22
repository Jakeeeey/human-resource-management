"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchMsTemplates, type DesignRow } from "../providers/msTemplates";

export interface UseMsTemplatesResult {
    data: DesignRow[] | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

/**
 * Lists mailing-studio templates via the real templates route.
 * @param isActive - Optional server-side active filter.
 * @returns { data, isLoading, error, refetch } — data is null until loaded.
 */
export function useMsTemplates(isActive?: boolean): UseMsTemplatesResult {
    const [data, setData] = useState<DesignRow[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await fetchMsTemplates(isActive));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setIsLoading(false);
        }
    }, [isActive]);

    useEffect(() => {
        void refetch();
    }, [refetch]);

    return { data, isLoading, error, refetch };
}
