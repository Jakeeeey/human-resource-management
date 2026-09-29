"use client";

import { useMemo, useState } from "react";

/** Studio list page size (QA §11 default). */
export const MS_PAGE_SIZE = 10;

interface MsPagination {
    readonly page: number;
    readonly totalPages: number;
    readonly pageItems: <T>(items: readonly T[]) => T[];
    readonly setPage: (page: number) => void;
    readonly resetPage: () => void;
}

/**
 * Client pagination over an already-filtered list. Page clamps when the list
 * shrinks; callers reset to page 1 whenever a filter, sort, or search input
 * changes (QA §11).
 */
export function useMsPagination(totalItems: number, pageSize: number = MS_PAGE_SIZE): MsPagination {
    const [page, setPageState] = useState(1);

    const totalPages = useMemo(() => {
        return Math.max(1, Math.ceil(totalItems / pageSize));
    }, [totalItems, pageSize]);

    return useMemo(() => {
        const clamped = Math.min(Math.max(1, page), totalPages);
        const setPage = (next: number): void => {
            setPageState(Math.min(Math.max(1, next), totalPages));
        };
        const resetPage = (): void => {
            setPageState(1);
        };
        const pageItems = <T,>(items: readonly T[]): T[] => {
            const start = (clamped - 1) * pageSize;
            return items.slice(start, start + pageSize);
        };
        return { page: clamped, totalPages, pageItems, setPage, resetPage };
    }, [page, totalPages, pageSize]);
}
