"use client";

import { useMemo } from "react";
import type {
    EmployeeFileRecordListWithRelations,
    EmployeeFileRecordListFormData,
} from "../types";
import type { EmployeeFileRecordType } from "../../employee-file-record-type/types";
import { useEmployeeFileRecordListFilterContext } from "../providers/filterProvider";
import { useEmployeeFileRecordListFetchContext } from "../providers/fetchProvider";

interface UseEmployeeFileRecordListReturn {
    records: EmployeeFileRecordListWithRelations[];
    recordTypes: EmployeeFileRecordType[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createRecord: (data: EmployeeFileRecordListFormData) => Promise<void>;
    updateRecord: (id: number, data: EmployeeFileRecordListFormData) => Promise<void>;
    deleteRecord: (id: number) => Promise<void>;
}

export function useEmployeeFileRecordList(): UseEmployeeFileRecordListReturn {
    const { filters } = useEmployeeFileRecordListFilterContext();
    const {
        allRecords,
        recordTypes,
        isLoading,
        isError,
        error,
        refetch,
        createRecord,
        updateRecord,
        deleteRecord,
    } = useEmployeeFileRecordListFetchContext();

    const records = useMemo(() => {
        let result = allRecords;

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter(
                (r) =>
                    r.name?.toLowerCase().includes(s) ||
                    r.description?.toLowerCase().includes(s)
            );
        }

        if (filters.recordTypeId != null) {
            result = result.filter(
                (r) => r.record_type_id === filters.recordTypeId
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
        recordTypes,
        isLoading,
        isError,
        error,
        refetch,
        createRecord,
        updateRecord,
        deleteRecord,
    };
}
