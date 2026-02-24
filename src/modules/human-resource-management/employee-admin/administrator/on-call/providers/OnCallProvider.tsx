"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useScmFilters } from "@/modules/human-resource-management/employee-admin/administrator/providers/ScmFilterProvider";
import { EnrichedOnCallSchedule } from "../types/on-call.schema";
import { toast } from "sonner";

interface OnCallContextType {
    data: EnrichedOnCallSchedule[];
    allSchedules: EnrichedOnCallSchedule[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createSchedule: (schedule: any, staffIds: number[]) => Promise<boolean>;
    updateSchedule: (id: number, schedule: any, staffIds: number[]) => Promise<boolean>;
    deleteSchedule: (id: number) => Promise<boolean>;
}

const OnCallContext = createContext<OnCallContextType | undefined>(undefined);

export function OnCallProvider({ children }: { children: React.ReactNode }) {
    const { selectedDepartment } = useScmFilters();
    const [data, setData] = useState<EnrichedOnCallSchedule[]>([]);
    const [allSchedules, setAllSchedules] = useState<EnrichedOnCallSchedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            const schedules: EnrichedOnCallSchedule[] = result.data;

            setAllSchedules(schedules);

            // Filter locally based on selected department
            if (selectedDepartment && selectedDepartment !== "all") {
                setData(schedules.filter(s => s.department_name === selectedDepartment));
            } else {
                setData(schedules);
            }
        } catch (err: any) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [selectedDepartment]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const createSchedule = async (schedule: any, staffIds: number[]) => {
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
            refresh();
            return true;
        } catch (err: any) {
            toast.error(err.message);
            return false;
        }
    };

    const updateSchedule = async (id: number, schedule: any, staffIds: number[]) => {
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
            refresh();
            return true;
        } catch (err: any) {
            toast.error(err.message);
            return false;
        }
    };

    const deleteSchedule = async (id: number) => {
        try {
            const response = await fetch(`/api/hrm/employee-admin/administrator/on-call/${id}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to delete schedule");
            }
            toast.success("Schedule deleted successfully");
            refresh();
            return true;
        } catch (err: any) {
            toast.error(err.message);
            return false;
        }
    };

    return (
        <OnCallContext.Provider value={{
            data,
            allSchedules,
            isLoading,
            error,
            refresh,
            createSchedule,
            updateSchedule,
            deleteSchedule
        }}>
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
