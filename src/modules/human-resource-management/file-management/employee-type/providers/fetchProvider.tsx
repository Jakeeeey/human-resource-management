"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { EmployeeType, EmployeeTypeFormData } from "../types";

interface EmployeeTypeFetchContextValue {
    allRecords: EmployeeType[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createRecord: (data: EmployeeTypeFormData) => Promise<void>;
    updateRecord: (id: number, data: EmployeeTypeFormData) => Promise<void>;
    deleteRecord: (id: number) => Promise<void>;
}

const EmployeeTypeFetchContext = createContext<EmployeeTypeFetchContextValue | undefined>(undefined);

export function EmployeeTypeFetchProvider({ children }: { children: React.ReactNode }): React.ReactNode {
    const [allRecords, setAllRecords] = useState<EmployeeType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);

            const res = await fetch(
                "/api/hrm/file-management/employee-type",
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

    const createRecord = useCallback(async (data: EmployeeTypeFormData) => {
        const res = await fetch("/api/hrm/file-management/employee-type", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to create record");
        await fetchData();
    }, [fetchData]);

    const updateRecord = useCallback(async (id: number, data: EmployeeTypeFormData) => {
        const res = await fetch("/api/hrm/file-management/employee-type", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, ...data }),
        });
        if (!res.ok) throw new Error("Failed to update record");
        await fetchData();
    }, [fetchData]);

    const deleteRecord = useCallback(async (id: number) => {
        const res = await fetch(`/api/hrm/file-management/employee-type?id=${id}`, {
            method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete record");
        await fetchData();
    }, [fetchData]);

    const value: EmployeeTypeFetchContextValue = {
        allRecords,
        isLoading,
        isError,
        error,
        refetch: fetchData,
        createRecord,
        updateRecord,
        deleteRecord,
    };

    return (
        <EmployeeTypeFetchContext.Provider value={value}>
            {children}
        </EmployeeTypeFetchContext.Provider>
    );
}

export function useEmployeeTypeFetchContext() {
    const context = useContext(EmployeeTypeFetchContext);
    if (context === undefined) {
        throw new Error("useEmployeeTypeFetchContext must be used within an EmployeeTypeFetchProvider");
    }
    return context;
}
