"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchMsGroups } from "../providers/msGroupsClient";
import type { MsGroupRow } from "../types";

export interface UseMsGroupsResult {
    data: MsGroupRow[] | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useMsGroups(isActive?: boolean): UseMsGroupsResult {
    const [data, setData] = useState<MsGroupRow[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            setData(await fetchMsGroups(isActive));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setIsLoading(false);
        }
    }, [isActive]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return { data, isLoading, error, refresh };
}
