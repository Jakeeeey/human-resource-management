"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { 
    EmployeeFileRecordListWithRelations,
    EmployeeFileRecordListFormData 
} from "../types";
import type { EmployeeFileRecordType } from "../../employee-file-record-type/types";

interface EmployeeFileRecordListFetchContextType {
    allRecords: EmployeeFileRecordListWithRelations[];
    recordTypes: EmployeeFileRecordType[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createRecord: (data: EmployeeFileRecordListFormData) => Promise<void>;
    updateRecord: (id: number, data: EmployeeFileRecordListFormData) => Promise<void>;
    deleteRecord: (id: number) => Promise<void>;
}

const EmployeeFileRecordListFetchContext =
    createContext<EmployeeFileRecordListFetchContextType | undefined>(undefined);

export function EmployeeFileRecordListFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
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
        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const createRecord = useCallback(
        async (data: EmployeeFileRecordListFormData) => {
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
        async (id: number, data: EmployeeFileRecordListFormData) => {
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

    return React.createElement(
        EmployeeFileRecordListFetchContext.Provider,
        {
            value: {
                allRecords,
                recordTypes,
                isLoading,
                isError,
                error,
                refetch: fetchData,
                createRecord,
                updateRecord,
                deleteRecord,
            },
        },
        children
    );
}

export function useEmployeeFileRecordListFetchContext() {
    const ctx = useContext(EmployeeFileRecordListFetchContext);
    if (!ctx)
        throw new Error(
            "Must be used inside EmployeeFileRecordListFetchProvider"
        );
    return ctx;
}
