"use client";

import { useMemo } from "react";
import type { 
    EmployeeFileRecordType,
    EmployeeFileRecordTypeFormData 
} from "../types";
import { useEmployeeFileRecordTypeFilterContext } from "../providers/filterProvider";
import { useEmployeeFileRecordTypeFetchContext } from "../providers/fetchProvider";

interface UseEmployeeFileRecordTypeReturn {
    records: EmployeeFileRecordType[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createRecord: (data: EmployeeFileRecordTypeFormData) => Promise<void>;
    updateRecord: (id: number, data: EmployeeFileRecordTypeFormData) => Promise<void>;
    deleteRecord: (id: number) => Promise<void>;
}

export function useEmployeeFileRecordType(): UseEmployeeFileRecordTypeReturn {
    const { filters } = useEmployeeFileRecordTypeFilterContext();
    const {
        allRecords,
        isLoading,
        isError,
        error,
        refetch,
        createRecord,
        updateRecord,
        deleteRecord,
    } = useEmployeeFileRecordTypeFetchContext();

    const records = useMemo(() => {
        let result = allRecords;

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter((r) =>
                r.name?.toLowerCase().includes(s) ||
                r.description?.toLowerCase().includes(s)
            );
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
