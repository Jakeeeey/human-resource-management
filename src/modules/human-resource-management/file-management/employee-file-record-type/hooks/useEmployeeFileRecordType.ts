"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { EmployeeFileRecordType } from "../types";
import { useEmployeeFileRecordTypeFilterContext } from "../providers/fetchProvider";

interface UseEmployeeFileRecordTypeReturn {
    records: EmployeeFileRecordType[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createRecord: (data: any) => Promise<void>;
    updateRecord: (id: number, data: any) => Promise<void>;
    deleteRecord: (id: number) => Promise<void>;
}

export function useEmployeeFileRecordType(): UseEmployeeFileRecordTypeReturn {
    const { filters } = useEmployeeFileRecordTypeFilterContext();

    const [allRecords, setAllRecords] = useState<EmployeeFileRecordType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);

            const res = await fetch(
                "/api/hrm/file-management/employee-file-record-type",
                { cache: "no-store" }
            );

            if (!res.ok) throw new Error("Fetch failed");

            const data = await res.json();
            setAllRecords(data.records || []);
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

    const createRecord = useCallback(
        async (data: any) => {
            const res = await fetch(
                "/api/hrm/file-management/employee-file-record-type",
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
                "/api/hrm/file-management/employee-file-record-type",
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
                `/api/hrm/file-management/employee-file-record-type?id=${id}`,
                { method: "DELETE" }
            );
            if (!res.ok) throw new Error("Delete failed");
            await fetchData();
        },
        [fetchData]
    );

    return {
        records,
        isLoading,
        isError,
        error,
        refetch: fetchData,
        createRecord,
        updateRecord,
        deleteRecord,
    };
}
