"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchMsOutbox } from "../providers/msOutbox";
import type { MsMaskedOutboxRow } from "../utils/ms-mask";

export interface UseMsOutboxResult {
    data: MsMaskedOutboxRow[] | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

/**
 * Lists masked outbox rows via the real outbox route (read-only viewer —
 * there is no resend endpoint, so this hook exposes no mutation).
 * @param status - Optional status filter (queued|sent|failed|skipped|dry_run).
 * @returns { data, isLoading, error, refetch } — rows carry masked recipients.
 */
export function useMsOutbox(status?: string): UseMsOutboxResult {
    const [data, setData] = useState<MsMaskedOutboxRow[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await fetchMsOutbox(status));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setIsLoading(false);
        }
    }, [status]);

    useEffect(() => {
        void refetch();
    }, [refetch]);

    return { data, isLoading, error, refetch };
}
