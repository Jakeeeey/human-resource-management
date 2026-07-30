"use client";

import { useMemo } from "react";
import type { EmployeeType, EmployeeTypeFormData } from "../types";
import { useEmployeeTypeFilterContext } from "../providers/filterProvider";
import { useEmployeeTypeFetchContext } from "../providers/fetchProvider";

interface UseEmployeeTypeReturn {
    records: EmployeeType[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createRecord: (data: EmployeeTypeFormData) => Promise<void>;
    updateRecord: (id: number, data: EmployeeTypeFormData) => Promise<void>;
    deleteRecord: (id: number) => Promise<void>;
}

export function useEmployeeType(): UseEmployeeTypeReturn {
    const { filters } = useEmployeeTypeFilterContext();
    const {
        allRecords,
        isLoading,
        isError,
        error,
        refetch,
        createRecord,
        updateRecord,
        deleteRecord,
    } = useEmployeeTypeFetchContext();

    const records = useMemo(() => {
        let result = allRecords;

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter((r) =>
                r.type_name?.toLowerCase().includes(s) ||
                r.description?.toLowerCase().includes(s)
            );
        }

        if (filters.type_name) {
            const selected = filters.type_name.toLowerCase();
            result = result.filter((r) => r.type_name?.toLowerCase() === selected);
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
