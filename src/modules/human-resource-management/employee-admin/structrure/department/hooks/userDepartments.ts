"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import type { DepartmentWithRelations, Division, User } from "../types";
import { useDepartmentFilterContext } from "../providers/DepartmentFilterProvider";
import { toastServerDown } from "@/modules/human-resource-management/employee-admin/administrator/utils/utils";

interface UseDepartmentsReturn {
    departments: DepartmentWithRelations[];
    divisions: Division[];
    users: User[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createDepartment: (data: Record<string, unknown>) => Promise<void>;
    updateDepartment: (id: number, data: Record<string, unknown>) => Promise<void>;
    deleteDepartment: (id: number) => Promise<void>;
}

export function useDepartments(): UseDepartmentsReturn {
    const { filters } = useDepartmentFilterContext();

    // store ALL data
    const [allDepartments, setAllDepartments] = useState<DepartmentWithRelations[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // =========================
    // FETCH ONCE
    // =========================
    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);

            const res = await fetch(
                "/api/hrm/employee-admin/structure/department",
                { cache: "no-store" }
            );

            if (!res.ok) throw new Error("Fetch failed");

            const data = await res.json();

            setAllDepartments(data.departments || []);
            setDivisions(data.divisions || []);
            setUsers(data.users || []);
        } catch (err) {
            setIsError(true);
            const error = err as Error;
            setError(error);
            toastServerDown(error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // =========================
    // CLIENT FILTERING (NO LOADING)
    // =========================
    const departments = useMemo(() => {
        let result = allDepartments;

        if (filters.search) {
            const s = filters.search.toLowerCase();
            result = result.filter(d =>
                d.department_name?.toLowerCase().includes(s)
            );
        }

        if (filters.dateRange.from) {
            const from = new Date(filters.dateRange.from);
            result = result.filter(
                d => new Date(d.date_added) >= from
            );
        }

        if (filters.dateRange.to) {
            const to = new Date(filters.dateRange.to);
            to.setHours(23, 59, 59, 999);
            result = result.filter(
                d => new Date(d.date_added) <= to
            );
        }

        return result;
    }, [allDepartments, filters]);

    // =========================
    // CRUD
    // =========================
    const createDepartment = useCallback(async (data: Record<string, unknown>) => {
        const res = await fetch("/api/hrm/employee-admin/structure/department", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Create failed");
        await fetchData();
    }, [fetchData]);

    const updateDepartment = useCallback(async (id: number, data: Record<string, unknown>) => {
        const res = await fetch("/api/hrm/employee-admin/structure/department", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ department_id: id, ...data }),
        });
        if (!res.ok) throw new Error("Update failed");
        await fetchData();
    }, [fetchData]);

    const deleteDepartment = useCallback(async (id: number) => {
        const res = await fetch(
            `/api/hrm/employee-admin/structure/department?id=${id}`,
            { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Delete failed");
        await fetchData();
    }, [fetchData]);

    return {
        departments,
        divisions,
        users,
        isLoading,
        isError,
        error,
        refetch: fetchData,
        createDepartment,
        updateDepartment,
        deleteDepartment,
    };
}
