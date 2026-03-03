"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { DivisionWithRelations, User, Department, BankAccount } from "../types";
import { useDivisionFilterContext } from "../providers/DivisionFilterProvider";
import { toastServerDown } from "@/modules/human-resource-management/employee-admin/administrator/utils/utils";

interface UseDivisionsReturn {
    divisions: DivisionWithRelations[];
    users: User[];
    departments: Department[];
    bankAccounts: BankAccount[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createDivision: (data: Record<string, unknown>) => Promise<void>;
    updateDivision: (id: number, data: Record<string, unknown>) => Promise<void>;
    deleteDivision: (id: number) => Promise<void>;
}

export function useDivisions(): UseDivisionsReturn {
    const { filters } = useDivisionFilterContext();

    const [allDivisions, setAllDivisions] = useState<DivisionWithRelations[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
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
                "/api/hrm/employee-admin/structure/division",
                { cache: "no-store" }
            );

            if (!res.ok) {
                throw new Error(`API error: ${res.status}`);
            }

            const data = await res.json();

            setAllDivisions(data.divisions || []);
            setUsers(data.users || []);
            setDepartments(data.departments || []);
            setBankAccounts(data.bank_accounts || []);
            hasLoadedRef.current = true;

        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error("Unknown error"));
            console.error("Division fetch error:", err);
            toastServerDown(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    useEffect(() => {
        const handleFocus = () => fetchData(false);
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [fetchData]);

    const filteredDivisions = useMemo(() => {
        let result = allDivisions;

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter(d =>
                d.division_name.toLowerCase().includes(s) ||
                d.division_code?.toLowerCase().includes(s)
            );
        }

        if (filters.dateRange.from) {
            const from = new Date(filters.dateRange.from);
            result = result.filter(d => new Date(d.date_added) >= from);
        }

        if (filters.dateRange.to) {
            const to = new Date(filters.dateRange.to);
            to.setHours(23, 59, 59, 999);
            result = result.filter(d => new Date(d.date_added) <= to);
        }

        return result;
    }, [allDivisions, filters]);

    // ✅ FIXED: Better error handling
    const createDivision = useCallback(async (data: Record<string, unknown>) => {
        try {
            console.log('Creating division with data:', data);

            const res = await fetch("/api/hrm/employee-admin/structure/division", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const errorMessage = errorData.message || errorData.error || `Server error: ${res.status} ${res.statusText}`;
                console.error('Create division failed:', errorMessage, errorData);
                throw new Error(errorMessage);
            }

            await fetchData(true);
        } catch (err) {
            console.error('Create division error:', err);
            throw err;
        }
    }, [fetchData]);

    // ✅ FIXED: Better error handling
    const updateDivision = useCallback(async (id: number, data: Record<string, unknown>) => {
        try {
            console.log('Updating division:', id, data);

            const res = await fetch("/api/hrm/employee-admin/structure/division", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ division_id: id, ...data }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const errorMessage = errorData.message || errorData.error || `Server error: ${res.status} ${res.statusText}`;
                console.error('Update division failed:', errorMessage, errorData);
                throw new Error(errorMessage);
            }

            await fetchData(true);
        } catch (err) {
            console.error('Update division error:', err);
            throw err;
        }
    }, [fetchData]);

    const deleteDivision = useCallback(async (id: number) => {
        try {
            const res = await fetch(
                `/api/hrm/employee-admin/structure/division?id=${id}`,
                { method: "DELETE" }
            );

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const errorMessage = errorData.message || errorData.error || `Server error: ${res.status} ${res.statusText}`;
                console.error('Delete division failed:', errorMessage, errorData);
                throw new Error(errorMessage);
            }

            await fetchData(true);
        } catch (err) {
            console.error('Delete division error:', err);
            throw err;
        }
    }, [fetchData]);

    return {
        divisions: filteredDivisions,
        users,
        departments,
        bankAccounts,
        isLoading,
        isError,
        error,
        refetch: () => fetchData(true),
        createDivision,
        updateDivision,
        deleteDivision,
    };
}