"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchMsCatalog } from "../providers/msCatalog";
import type { MsCatalogRow } from "../types/ms-catalog.schema";

export interface UseMsCatalogResult {
    data: MsCatalogRow[] | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useMsCatalog(isActive?: boolean): UseMsCatalogResult {
    const [data, setData] = useState<MsCatalogRow[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            setData(
                await fetchMsCatalog(
                    isActive === undefined ? undefined : { is_active: isActive },
                ),
            );
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
