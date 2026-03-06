"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type {
    EmployeeFileRecordType,
    EmployeeFileRecordTypeFormData
} from "../types";

interface EmployeeFileRecordTypeFetchContextType {
    allRecords: EmployeeFileRecordType[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createRecord: (data: EmployeeFileRecordTypeFormData) => Promise<void>;
    updateRecord: (id: number, data: EmployeeFileRecordTypeFormData) => Promise<void>;
    deleteRecord: (id: number) => Promise<void>;
}

const EmployeeFileRecordTypeFetchContext =
    createContext<EmployeeFileRecordTypeFetchContextType | undefined>(undefined);

export function EmployeeFileRecordTypeFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
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
        async (data: EmployeeFileRecordTypeFormData) => {
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
        async (id: number, data: EmployeeFileRecordTypeFormData) => {
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

    return React.createElement(
        EmployeeFileRecordTypeFetchContext.Provider,
        {
            value: {
                allRecords,
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

export function useEmployeeFileRecordTypeFetchContext() {
    const ctx = useContext(EmployeeFileRecordTypeFetchContext);
    if (!ctx)
        throw new Error(
            "Must be used inside EmployeeFileRecordTypeFetchProvider"
        );
    return ctx;
}
