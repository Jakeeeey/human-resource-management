"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
    listCategorySignatories,
    replaceCategorySignatories,
} from "../providers/clearanceTemplatesClient";

export interface CategoryPoolResource {
    userIds: number[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    replace: (userIds: number[]) => Promise<void>;
}

export function useCategoryPool(
    templateId: number | null,
    categoryId: number | null,
    enabled: boolean
): CategoryPoolResource {
    const [userIds, setUserIds] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        if (templateId === null || categoryId === null || !enabled) {
            setUserIds([]);
            setIsLoading(false);
            setIsError(false);
            setError(null);
            return;
        }
        try {
            setIsLoading(true);
            setIsError(false);
            setError(null);
            const rows = await listCategorySignatories(templateId, categoryId);
            setUserIds(rows.map((row) => row.user_id));
        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoading(false);
        }
    }, [templateId, categoryId, enabled]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const replace = useCallback(
        async (next: number[]) => {
            if (templateId === null || categoryId === null) {
                throw new Error("Select a category before editing its signer pool");
            }
            if (next.length === 0) {
                throw new Error("At least one signer is required");
            }
            await replaceCategorySignatories(templateId, categoryId, next);
            await refresh();
        },
        [templateId, categoryId, refresh]
    );

    return useMemo(
        () => ({ userIds, isLoading, isError, error, refresh, replace }),
        [userIds, isLoading, isError, error, refresh, replace]
    );
}
