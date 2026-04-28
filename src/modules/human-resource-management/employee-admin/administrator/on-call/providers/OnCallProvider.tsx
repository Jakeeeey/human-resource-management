"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { useScmFilters } from "@/modules/human-resource-management/employee-admin/administrator/providers/ScmFilterProvider";
import { EnrichedOnCallSchedule } from "../types/on-call.schema";
import { toast } from "sonner";
import { toastServerDown } from "@/modules/human-resource-management/employee-admin/administrator/utils/utils";

interface OnCallContextType {
    data: EnrichedOnCallSchedule[];
    allSchedules: EnrichedOnCallSchedule[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createSchedule: (schedule: Record<string, unknown>, staffIds: number[]) => Promise<boolean>;
    updateSchedule: (id: number, schedule: Record<string, unknown>, staffIds: number[]) => Promise<boolean>;
    deleteSchedule: (id: number) => Promise<boolean>;
}

const OnCallContext = createContext<OnCallContextType | undefined>(undefined);

export function OnCallProvider({ children }: { children: React.ReactNode }) {
    const { selectedDepartment } = useScmFilters();
    const [allSchedules, setAllSchedules] = useState<EnrichedOnCallSchedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * refresh has an empty dependency array — it is a permanently stable reference.
     *
     * Previously it depended on selectedDepartment, which caused the cascade:
     *   ScmFilterProvider re-reads searchParams
     *   → new selectedDepartment string ref
     *   → new refresh callback reference
     *   → useEffect([refresh]) fires
     *   → setIsLoading(true) triggers context re-render
     *   → OnCallDialogContent re-renders
     *   → Radix Checkbox internal setState loop
     *
     * Fix: fetch ALL schedules unconditionally. Department filtering is done
     * in a separate useMemo below — no network call, no setState chain.
     */
    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/hrm/employee-admin/administrator/on-call");
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to fetch on-call schedules");
            }
            const result = await response.json();
            setAllSchedules(result.data as EnrichedOnCallSchedule[]);
        } catch (err) {
            const e = err as Error;
            setError(e.message);
            toastServerDown(e);
        } finally {
            setIsLoading(false);
        }
    }, []); // intentionally empty — see comment above

    useEffect(() => {
        refresh();
    }, [refresh]);

    /**
     * Derive the filtered view from already-fetched data.
     * A filter change only re-slices memory — no fetch, no setState, no loop.
     */
    const data = useMemo(() => {
        if (selectedDepartment && selectedDepartment !== "all") {
            return allSchedules.filter((s) => s.department_name === selectedDepartment);
        }
        return allSchedules;
    }, [allSchedules, selectedDepartment]);

    const createSchedule = useCallback(async (schedule: Record<string, unknown>, staffIds: number[]) => {
        try {
            const response = await fetch("/api/hrm/employee-admin/administrator/on-call", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...schedule, staffIds }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to create schedule");
            }
            toast.success("Schedule created successfully");
            await refresh();
            return true;
        } catch (err) {
            toastServerDown(err as Error);
            return false;
        }
    }, [refresh]);

    const updateSchedule = useCallback(async (id: number, schedule: Record<string, unknown>, staffIds: number[]) => {
        try {
            const response = await fetch(`/api/hrm/employee-admin/administrator/on-call/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...schedule, staffIds }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to update schedule");
            }
            toast.success("Schedule updated successfully");
            await refresh();
            return true;
        } catch (err) {
            toastServerDown(err as Error);
            return false;
        }
    }, [refresh]);

    const deleteSchedule = useCallback(async (id: number) => {
        try {
            const response = await fetch(`/api/hrm/employee-admin/administrator/on-call/${id}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to delete schedule");
            }
            toast.success("Schedule deleted successfully");
            await refresh();
            return true;
        } catch (err) {
            toastServerDown(err as Error);
            return false;
        }
    }, [refresh]);

    const contextValue = useMemo(() => ({
        data,
        allSchedules,
        isLoading,
        error,
        refresh,
        createSchedule,
        updateSchedule,
        deleteSchedule,
    }), [data, allSchedules, isLoading, error, refresh, createSchedule, updateSchedule, deleteSchedule]);

    return (
        <OnCallContext.Provider value={contextValue}>
            {children}
        </OnCallContext.Provider>
    );
}

export function useOnCallContext() {
    const context = useContext(OnCallContext);
    if (context === undefined) {
        throw new Error("useOnCallContext must be used within an OnCallProvider");
    }
    return context;
}
