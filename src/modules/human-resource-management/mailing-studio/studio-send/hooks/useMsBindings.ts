"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchMsBindings } from "../providers/msBindings";
import type { MsBindingRow } from "../types/ms-binding.schema";

export interface UseMsBindingsResult {
    data: MsBindingRow[] | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useMsBindings(): UseMsBindingsResult {
    const [data, setData] = useState<MsBindingRow[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await fetchMsBindings());
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
