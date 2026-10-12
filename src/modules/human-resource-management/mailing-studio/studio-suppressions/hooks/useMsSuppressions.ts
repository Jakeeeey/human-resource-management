"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchMsSuppressions } from "../providers/msSuppressionsClient";
import type { MsSuppressionRow, SuppressionReason } from "../types";

export interface UseMsSuppressionsResult {
    data: MsSuppressionRow[] | null;
    total: number;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useMsSuppressions(reason?: SuppressionReason): UseMsSuppressionsResult {
    const [data, setData] = useState<MsSuppressionRow[] | null>(null);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            const list = await fetchMsSuppressions(reason);
            setData(list.rows);
            setTotal(list.total);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setIsLoading(false);
        }
    }, [reason]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { data, total, isLoading, error, refresh };
}
