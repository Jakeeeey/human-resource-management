"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type {
    EmployeeFileRecordListWithRelations,
} from "../types";
import type { EmployeeFileRecordType } from "../../employee-file-record-type/types";
import { useEmployeeFileRecordListFilterContext } from "../providers/fetchProvider";

interface UseEmployeeFileRecordListReturn {
    records: EmployeeFileRecordListWithRelations[];
    recordTypes: EmployeeFileRecordType[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createRecord: (data: any) => Promise<void>;
    updateRecord: (id: number, data: any) => Promise<void>;
    deleteRecord: (id: number) => Promise<void>;
}

export function useEmployeeFileRecordList(): UseEmployeeFileRecordListReturn {
    const { filters } = useEmployeeFileRecordListFilterContext();

    const [allRecords, setAllRecords] = useState<EmployeeFileRecordListWithRelations[]>([]);
    const [recordTypes, setRecordTypes] = useState<EmployeeFileRecordType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);

            const res = await fetch(
                "/api/hrm/file-management/employee-file-record-list",
                { cache: "no-store" }
            );

            if (!res.ok) throw new Error("Fetch failed");

            const data = await res.json();
            setAllRecords(data.records || []);
            setRecordTypes(data.recordTypes || []);
        } catch (err: any) {
            setIsError(true);
            setError(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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

    const createRecord = useCallback(
        async (data: any) => {
            const res = await fetch(
                "/api/hrm/file-management/employee-file-record-list",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                }
            );
            if (!res.ok) throw new Error("Create failed");
            await fetchData();
        },
        [fetchData]
    );

    const updateRecord = useCallback(
        async (id: number, data: any) => {
            const res = await fetch(
                "/api/hrm/file-management/employee-file-record-list",
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id, ...data }),
                }
            );
            if (!res.ok) throw new Error("Update failed");
            await fetchData();
        },
        [fetchData]
    );

    const deleteRecord = useCallback(
        async (id: number) => {
            const res = await fetch(
                `/api/hrm/file-management/employee-file-record-list?id=${id}`,
                { method: "DELETE" }
            );
            if (!res.ok) throw new Error("Delete failed");
            await fetchData();
        },
        [fetchData]
    );

    return {
        records,
        recordTypes,
        isLoading,
        isError,
        error,
        refetch: fetchData,
        createRecord,
        updateRecord,
        deleteRecord,
    };
}
