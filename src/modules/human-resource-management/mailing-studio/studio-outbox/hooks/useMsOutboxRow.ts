"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchMsOutboxRow } from "../providers/msOutbox";
import type { MsMaskedOutboxRow } from "../utils/ms-mask";

export interface UseMsOutboxRowResult {
    data: MsMaskedOutboxRow | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

/**
 * Reads one masked outbox row via the real by-id route.
 * @param id - Outbox row id (null skips the fetch, e.g. nothing selected).
 * @returns { data, isLoading, error, refetch } — masked, read-only.
 */
export function useMsOutboxRow(id: string | number | null): UseMsOutboxRowResult {
    const [data, setData] = useState<MsMaskedOutboxRow | null>(null);
    const [isLoading, setIsLoading] = useState(id !== null);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async (): Promise<void> => {
        if (id === null) {
            setData(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            setData(await fetchMsOutboxRow(id));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void refetch();
    }, [refetch]);

    return { data, isLoading, error, refetch };
}
