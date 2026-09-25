"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
    fetchMsOutbox,
    MS_OUTBOX_PAGE_SIZE,
    type MsOutboxPage,
    type MsOutboxQuery,
} from "../providers/msOutbox";

export interface UseMsOutboxResult {
    data: MsOutboxPage | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useMsOutbox(query: MsOutboxQuery = {}): UseMsOutboxResult {
    const [data, setData] = useState<MsOutboxPage | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestSeq = useRef(0);

    const status = query.status;
    const eventKey = query.eventKey;
    const search = query.search;
    const sort = query.sort;
    const page = query.page ?? 1;
    const limit = query.limit ?? MS_OUTBOX_PAGE_SIZE;

    const refetch = useCallback(async (): Promise<void> => {
        const seq = requestSeq.current + 1;
        requestSeq.current = seq;
        setIsLoading(true);
        setError(null);
        try {
            const result = await fetchMsOutbox({ status, eventKey, search, sort, page, limit });
            if (requestSeq.current !== seq) return;
            setData(result);
        } catch (cause) {
            if (requestSeq.current !== seq) return;
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            if (requestSeq.current === seq) setIsLoading(false);
        }
    }, [status, eventKey, search, sort, page, limit]);

    useEffect(() => {
        void refetch();
    }, [refetch]);

    return { data, isLoading, error, refetch };
}
