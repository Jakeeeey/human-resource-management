"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { DepartmentWithRelations, Division, User } from "../types";
import { useDepartmentFilterContext } from "../providers/DepartmentFilterProvider";
import { useDebounce } from "../hooks/useDebounce";

interface UseDepartmentsReturn {
    departments: DepartmentWithRelations[];
    divisions: Division[];
    users: User[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createDepartment: (data: any) => Promise<void>;
    updateDepartment: (id: number, data: any) => Promise<void>;
    deleteDepartment: (id: number) => Promise<void>;
}

export function useDepartments(): UseDepartmentsReturn {
    const { filters } = useDepartmentFilterContext();
    const debouncedSearch = useDebounce(filters.search, 500);

    const [departments, setDepartments] = useState<DepartmentWithRelations[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const abortRef = useRef<AbortController | null>(null);

    // =========================
    // FETCH CORE
    // =========================

    const fetchData = useCallback(
        async (activeFilters: typeof filters, searchValue: string) => {
            try {
                setIsError(false);
                setError(null);

                abortRef.current?.abort();
                const controller = new AbortController();
                abortRef.current = controller;

                const params = new URLSearchParams();

                if (searchValue) {
                    params.append("search", searchValue);
                }


                if (activeFilters.dateRange.from && activeFilters.dateRange.to) {
                    params.append("from", activeFilters.dateRange.from.toISOString());
                    params.append("to", activeFilters.dateRange.to.toISOString());
                }

                const loadingTimer = setTimeout(() => setIsLoading(true), 250);

                const res = await fetch(
                    `/api/hrm/employee-admin/structure/department?${params}`,
                    { signal: controller.signal, cache: "no-store" }
                );

                if (!res.ok) throw new Error("Fetch failed");

                const data = await res.json();

                clearTimeout(loadingTimer);
                setIsLoading(false);

                setDepartments(data.departments || []);
                setDivisions(data.divisions || []);
                setUsers(data.users || []);
            } catch (err: any) {
                if (err.name === "AbortError") return;
                setIsError(true);
                setError(err);
                setIsLoading(false);
            }
        },
        []
    );

    // =========================
    // EFFECT — SMART TRIGGER
    // =========================

    useEffect(() => {
        const { from, to } = filters.dateRange;

        // ✅ do not fetch during partial date select
        if ((from && !to) || (!from && to)) {
            return;
        }

        fetchData(filters, debouncedSearch);

    }, [debouncedSearch, filters.dateRange.from, filters.dateRange.to]);

    // =========================
    // CRUD
    // =========================

    const createDepartment = useCallback(async (data: any) => {
        const res = await fetch("/api/hrm/employee-admin/structure/department", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Create failed");
        fetchData(filters, debouncedSearch);
    }, [filters, debouncedSearch, fetchData]);

    const updateDepartment = useCallback(async (id: number, data: any) => {
        const res = await fetch("/api/hrm/employee-admin/structure/department", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ department_id: id, ...data }),
        });
        if (!res.ok) throw new Error("Update failed");
        fetchData(filters, debouncedSearch);
    }, [filters, debouncedSearch, fetchData]);

    const deleteDepartment = useCallback(async (id: number) => {
        const res = await fetch(
            `/api/hrm/employee-admin/structure/department?id=${id}`,
            { method: "DELETE" }
        );
        if (!res.ok) {
            const msg = await res.text();
            throw new Error(msg || "Delete failed");
        }
        fetchData(filters, debouncedSearch);
    }, [filters, debouncedSearch, fetchData]);

    return {
        departments,
        divisions,
        users,
        isLoading,
        isError,
        error,
        refetch: () => fetchData(filters, debouncedSearch),
        createDepartment,
        updateDepartment,
        deleteDepartment,
    };
}
