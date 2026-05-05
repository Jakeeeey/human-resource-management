"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { EmploymentStatus, EmploymentStatusFormData } from "../types";

interface EmploymentStatusFetchContextType {
    allRecords: EmploymentStatus[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createRecord: (data: EmploymentStatusFormData) => Promise<void>;
    updateRecord: (id: number, data: EmploymentStatusFormData) => Promise<void>;
    deleteRecord: (id: number) => Promise<void>;
}

const EmploymentStatusFetchContext =
    createContext<EmploymentStatusFetchContextType | undefined>(undefined);

export function EmploymentStatusFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [allRecords, setAllRecords] = useState<EmploymentStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);

            const res = await fetch(
                "/api/hrm/file-management/employment-status",
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
        async (data: EmploymentStatusFormData) => {
            const res = await fetch(
                "/api/hrm/file-management/employment-status",
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
        async (id: number, data: EmploymentStatusFormData) => {
            const res = await fetch(
                "/api/hrm/file-management/employment-status",
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
                `/api/hrm/file-management/employment-status?id=${id}`,
                { method: "DELETE" }
            );
            if (!res.ok) throw new Error("Delete failed");
            await fetchData();
        },
        [fetchData]
    );

    return React.createElement(
        EmploymentStatusFetchContext.Provider,
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

export function useEmploymentStatusFetchContext() {
    const ctx = useContext(EmploymentStatusFetchContext);
    if (!ctx)
        throw new Error("Must be used inside EmploymentStatusFetchProvider");
    return ctx;
}
