"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { OperationWithRelations, OperationFormData } from "../types";
import { useOperationFilterContext } from "../providers/OperationFilterProvider";

interface UseOperationsReturn {
    operations: OperationWithRelations[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createOperation: (data: OperationFormData) => Promise<void>;
    updateOperation: (id: number, data: OperationFormData) => Promise<void>;
    deleteOperation: (id: number) => Promise<void>;
}

export function useOperations(): UseOperationsReturn {
    const { filters } = useOperationFilterContext();

    const [allOperations, setAllOperations] = useState<OperationWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const hasLoadedRef = useRef(false);

    const fetchData = useCallback(async (showLoading = false) => {
        try {
            if (showLoading || !hasLoadedRef.current) {
                setIsLoading(true);
            }

            setIsError(false);
            setError(null);

            const res = await fetch(
                "/api/hrm/employee-admin/structure/operation",
                { cache: "no-store" }
            );

            if (!res.ok) {
                throw new Error(`API error: ${res.status}`);
            }

            const data = await res.json();
            setAllOperations(data.operations || []);
            hasLoadedRef.current = true;

        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error("Unknown error"));
            console.error("Operation fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    const filteredOperations = useMemo(() => {
        let result = allOperations;

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter(o =>
                (o.operation_name?.toLowerCase().includes(s)) ||
                (o.operation_code?.toLowerCase().includes(s))
            );
        }

        return result;
    }, [allOperations, filters.search]);

    const createOperation = useCallback(async (data: OperationFormData) => {
        try {
            const res = await fetch("/api/hrm/employee-admin/structure/operation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || `Server error: ${res.status}`);
            }

            await fetchData(true);
        } catch (err) {
            console.error('Create operation error:', err);
            throw err;
        }
    }, [fetchData]);

    const updateOperation = useCallback(async (id: number, data: OperationFormData) => {
        try {
            const res = await fetch("/api/hrm/employee-admin/structure/operation", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...data }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || `Server error: ${res.status}`);
            }

            await fetchData(true);
        } catch (err) {
            console.error('Update operation error:', err);
            throw err;
        }
    }, [fetchData]);

    const deleteOperation = useCallback(async (id: number) => {
        try {
            const res = await fetch(
                `/api/hrm/employee-admin/structure/operation?id=${id}`,
                { method: "DELETE" }
            );

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || `Server error: ${res.status}`);
            }

            await fetchData(true);
        } catch (err) {
            console.error('Delete operation error:', err);
            throw err;
        }
    }, [fetchData]);

    return {
        operations: filteredOperations,
        isLoading,
        isError,
        error,
        refetch: () => fetchData(true),
        createOperation,
        updateOperation,
        deleteOperation,
    };
}
