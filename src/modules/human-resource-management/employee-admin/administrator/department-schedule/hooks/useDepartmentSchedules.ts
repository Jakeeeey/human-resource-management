/**
 * useDepartmentSchedules Hook
 * Client-side filtering + CRUD operations
 */

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { DepartmentScheduleWithRelations, Department, User } from "../types";
import { useDepartmentScheduleFilterContext } from "../providers/DepartmentScheduleFilterProvider";

// ============================================================================
// HOOK
// ============================================================================

interface UseDepartmentSchedulesReturn {
    schedules: DepartmentScheduleWithRelations[];
    departments: Department[];
    users: User[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    createSchedule: (data: Record<string, unknown>) => Promise<void>;
    updateSchedule: (id: number, data: Record<string, unknown>) => Promise<void>;
    deleteSchedule: (id: number) => Promise<void>;
}

export function useDepartmentSchedules(): UseDepartmentSchedulesReturn {
    const { filters } = useDepartmentScheduleFilterContext();

    const [allSchedules, setAllSchedules] = useState<DepartmentScheduleWithRelations[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);
            setError(null);

            const url = `/api/hrm/employee-admin/administrator/department-schedule`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            setAllSchedules(data.schedules || []);
            setDepartments(data.departments || []);
            setUsers(data.users || []);
        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error("Unknown error"));
            console.error("Error fetching schedules:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Client-side filtering
    const filteredSchedules = useMemo(() => {
        let result = allSchedules;

        // Search filter (department name)
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            result = result.filter((schedule) =>
                schedule.department?.department_name.toLowerCase().includes(searchLower)
            );
        }

        // Date range filter
        if (filters.dateRange.from) {
            const from = new Date(filters.dateRange.from);
            result = result.filter(
                (schedule) => new Date(schedule.created_at) >= from
            );
        }

        if (filters.dateRange.to) {
            const to = new Date(filters.dateRange.to);
            to.setHours(23, 59, 59, 999);
            result = result.filter(
                (schedule) => new Date(schedule.created_at) <= to
            );
        }

        return result;
    }, [allSchedules, filters]);

    const createSchedule = useCallback(async (data: Record<string, unknown>) => {
        try {
            const response = await fetch('/api/hrm/employee-admin/administrator/department-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create schedule');
            }

            await fetchData();
        } catch (err) {
            console.error('Error creating schedule:', err);
            throw err;
        }
    }, [fetchData]);

    const updateSchedule = useCallback(async (id: number, data: Record<string, unknown>) => {
        try {
            const response = await fetch('/api/hrm/employee-admin/administrator/department-schedule', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schedule_id: id, ...data }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update schedule');
            }

            await fetchData();
        } catch (err) {
            console.error('Error updating schedule:', err);
            throw err;
        }
    }, [fetchData]);

    const deleteSchedule = useCallback(async (id: number) => {
        try {
            const response = await fetch(`/api/hrm/employee-admin/administrator/department-schedule?id=${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete schedule');
            }

            await fetchData();
        } catch (err) {
            console.error('Error deleting schedule:', err);
            throw err;
        }
    }, [fetchData]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const handleFocus = () => {
            fetchData();
        };

        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [fetchData]);

    return {
        schedules: filteredSchedules,
        departments,
        users,
        isLoading,
        isError,
        error,
        refetch: fetchData,
        createSchedule,
        updateSchedule,
        deleteSchedule,
    };
}