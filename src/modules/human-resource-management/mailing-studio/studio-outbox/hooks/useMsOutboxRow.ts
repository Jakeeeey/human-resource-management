"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchMsOutboxRow } from "../providers/msOutbox";
import type { MsOutboxRow } from "../types/ms-outbox-row";

export interface UseMsOutboxRowResult {
    data: MsOutboxRow | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useMsOutboxRow(id: string | number | null): UseMsOutboxRowResult {
    const [data, setData] = useState<MsOutboxRow | null>(null);
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
