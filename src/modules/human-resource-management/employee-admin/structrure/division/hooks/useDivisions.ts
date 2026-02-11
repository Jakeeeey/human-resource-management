"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { DivisionWithRelations, User, Department } from "../types";
import { useDivisionFilterContext } from "../providers/DivisionFilterProvider";

interface UseDivisionsReturn {
    divisions: DivisionWithRelations[];
    users: User[];
    departments: Department[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createDivision: (data: any) => Promise<void>;
    updateDivision: (id: number, data: any) => Promise<void>;
    deleteDivision: (id: number) => Promise<void>;
}

export function useDivisions(): UseDivisionsReturn {
    const { filters } = useDivisionFilterContext();

    const [allDivisions, setAllDivisions] = useState<DivisionWithRelations[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const hasLoadedRef = useRef(false);

    // =========================
    // FETCH
    // =========================
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
            hasLoadedRef.current = true;

        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error("Unknown error"));
            console.error("Division fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // first load
    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    // silent focus refresh
    useEffect(() => {
        const handleFocus = () => fetchData(false);
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [fetchData]);

    // =========================
    // CLIENT FILTERING (FAST — no loading on typing)
    // =========================
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

    // =========================
    // CRUD
    // =========================
    const createDivision = useCallback(async (data: any) => {
        const res = await fetch("/api/hrm/employee-admin/structure/division", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Create failed");
        await fetchData(true);
    }, [fetchData]);

    const updateDivision = useCallback(async (id: number, data: any) => {
        const res = await fetch("/api/hrm/employee-admin/structure/division", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ division_id: id, ...data }),
        });
        if (!res.ok) throw new Error("Update failed");
        await fetchData(true);
    }, [fetchData]);

    const deleteDivision = useCallback(async (id: number) => {
        const res = await fetch(
            `/api/hrm/employee-admin/structure/division?id=${id}`,
            { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Delete failed");
        await fetchData(true);
    }, [fetchData]);

    return {
        divisions: filteredDivisions,
        users,
        departments,
        isLoading,
        isError,
        error,
        refetch: () => fetchData(true),
        createDivision,
        updateDivision,
        deleteDivision,
    };
}
