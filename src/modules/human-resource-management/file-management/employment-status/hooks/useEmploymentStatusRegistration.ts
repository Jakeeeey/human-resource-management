"use client";

import { useMemo } from "react";
import type { EmploymentStatus, EmploymentStatusFormData } from "../types";
import { useEmploymentStatusFilterContext } from "../providers/filterProvider";
import { useEmploymentStatusFetchContext } from "../providers/fetchProvider";

interface UseEmploymentStatusRegistrationReturn {
    records: EmploymentStatus[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createRecord: (data: EmploymentStatusFormData) => Promise<void>;
    updateRecord: (id: number, data: EmploymentStatusFormData) => Promise<void>;
    deleteRecord: (id: number) => Promise<void>;
}

export function useEmploymentStatusRegistration(): UseEmploymentStatusRegistrationReturn {
    const { filters } = useEmploymentStatusFilterContext();
    const {
        allRecords,
        isLoading,
        isError,
        error,
        refetch,
        createRecord,
        updateRecord,
        deleteRecord,
    } = useEmploymentStatusFetchContext();

    const records = useMemo(() => {
        let result = allRecords;

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter((r) =>
                r.name?.toLowerCase().includes(s) ||
                r.description?.toLowerCase().includes(s)
            );
        }

        if (filters.name) {
            const selected = filters.name.toLowerCase();
            result = result.filter((r) => r.name?.toLowerCase() === selected);
        }

        if (filters.dateRange.from) {
            const from = new Date(filters.dateRange.from);
            result = result.filter((r) => new Date(r.created_at) >= from);
        }

        if (filters.dateRange.to) {
            const to = new Date(filters.dateRange.to);
            to.setHours(23, 59, 59, 999);
            result = result.filter((r) => new Date(r.created_at) <= to);
        }

        return result;
    }, [allRecords, filters]);

    return {
        records,
        isLoading,
        isError,
        error,
        refetch,
        createRecord,
        updateRecord,
        deleteRecord,
    };
}
