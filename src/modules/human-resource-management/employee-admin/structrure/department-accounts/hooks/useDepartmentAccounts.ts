/**
 * Custom hook for Department Accounts data fetching and mutations
 * Uses useState and useEffect pattern (no React Query dependency)
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    DepartmentAccountsAPIResponse,
    AssignedAccountsResponse,
    AssignAccountsPayload,
    UnassignAccountPayload,
} from "../types";
import { toastServerDown } from "@/modules/human-resource-management/employee-admin/administrator/utils/utils";

const API_BASE = "/api/hrm/employee-admin/structure/department-accounts";

// ============================================================================
// MASTER DATA HOOK
// ============================================================================

interface UseDepartmentAccountsMasterDataReturn {
    data: DepartmentAccountsAPIResponse | null;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

export function useDepartmentAccountsMasterData(): UseDepartmentAccountsMasterDataReturn {
    const [data, setData] = useState<DepartmentAccountsAPIResponse | null>(null);
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

            const res = await fetch(API_BASE, { cache: "no-store" });

            if (!res.ok) {
                throw new Error(`API error: ${res.status}`);
            }

            const responseData = await res.json();
            setData(responseData);
            hasLoadedRef.current = true;
        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error("Unknown error"));
            console.error("Department Accounts fetch error:", err);
            toastServerDown(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    // Silent refresh on window focus
    useEffect(() => {
        const handleFocus = () => fetchData(false);
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [fetchData]);

    return {
        data,
        isLoading,
        isError,
        error,
        refetch: () => fetchData(true),
    };
}

// ============================================================================
// ASSIGNED ACCOUNTS HOOK
// ============================================================================

interface UseAssignedAccountsReturn {
    data: AssignedAccountsResponse | null;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

export function useAssignedAccounts(
    deptDivId: number | null
): UseAssignedAccountsReturn {
    const [data, setData] = useState<AssignedAccountsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        if (!deptDivId) {
            setData(null);
            return;
        }

        try {
            setIsLoading(true);
            setIsError(false);
            setError(null);

            const res = await fetch(`${API_BASE}?dept_div_id=${deptDivId}`, {
                cache: "no-store",
            });

            if (!res.ok) {
                throw new Error(`API error: ${res.status}`);
            }

            const responseData = await res.json();
            setData(responseData);
        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error("Unknown error"));
            console.error("Assigned accounts fetch error:", err);
            toastServerDown(err);
        } finally {
            setIsLoading(false);
        }
    }, [deptDivId]);

    // Fetch when deptDivId changes
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        data,
        isLoading,
        isError,
        error,
        refetch: fetchData,
    };
}

// ============================================================================
// ASSIGN ACCOUNTS MUTATION
// ============================================================================

interface UseAssignAccountsReturn {
    mutateAsync: (payload: AssignAccountsPayload) => Promise<void>;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
}

export function useAssignAccounts(
    onSuccess?: () => void
): UseAssignAccountsReturn {
    const [isPending, setIsPending] = useState(false);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const mutateAsync = useCallback(
        async (payload: AssignAccountsPayload) => {
            try {
                setIsPending(true);
                setIsError(false);
                setError(null);

                const res = await fetch(API_BASE, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    throw new Error("Failed to assign accounts");
                }

                if (onSuccess) {
                    onSuccess();
                }
            } catch (err) {
                setIsError(true);
                setError(err instanceof Error ? err : new Error("Unknown error"));
                toastServerDown(err);
                throw err;
            } finally {
                setIsPending(false);
            }
        },
        [onSuccess]
    );

    return {
        mutateAsync,
        isPending,
        isError,
        error,
    };
}

// ============================================================================
// UNASSIGN ACCOUNT MUTATION
// ============================================================================

interface UseUnassignAccountReturn {
    mutateAsync: (payload: UnassignAccountPayload) => Promise<void>;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
}

export function useUnassignAccount(
    onSuccess?: () => void
): UseUnassignAccountReturn {
    const [isPending, setIsPending] = useState(false);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const mutateAsync = useCallback(
        async (payload: UnassignAccountPayload) => {
            try {
                setIsPending(true);
                setIsError(false);
                setError(null);

                const res = await fetch(
                    `${API_BASE}?dept_div_id=${payload.dept_div_id}&coa_id=${payload.coa_id}`,
                    {
                        method: "DELETE",
                    }
                );

                if (!res.ok) {
                    throw new Error("Failed to unassign account");
                }

                if (onSuccess) {
                    onSuccess();
                }
            } catch (err) {
                setIsError(true);
                setError(err instanceof Error ? err : new Error("Unknown error"));
                toastServerDown(err);
                throw err;
            } finally {
                setIsPending(false);
            }
        },
        [onSuccess]
    );

    return {
        mutateAsync,
        isPending,
        isError,
        error,
    };
}
