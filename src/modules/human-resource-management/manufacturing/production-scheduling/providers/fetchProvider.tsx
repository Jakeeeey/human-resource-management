"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ProductionSchedule, ScheduleFormValues } from "../types";
import type { ManufacturingLine } from "../../line-registration/types";
import { SchedulingService } from "../services/SchedulingService";
import { LineRegistrationService } from "../../line-registration/services/LineRegistrationService";

interface SchedulingFetchContextType {
    schedules: ProductionSchedule[];
    lines: ManufacturingLine[];
    isLoading: boolean;
    refetch: () => Promise<void>;
    addSchedule: (data: ScheduleFormValues, userId: number | null) => Promise<boolean>;
    updateSchedule: (id: number, data: ScheduleFormValues, current: ProductionSchedule, userId: number | null) => Promise<boolean>;
    removeSchedule: (id: number, userId?: number | null) => Promise<boolean>;
}

const SchedulingFetchContext = createContext<SchedulingFetchContextType | undefined>(undefined);

export function SchedulingFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [schedules, setSchedules] = useState<ProductionSchedule[]>([]);
    const [lines, setLines] = useState<ManufacturingLine[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [schedulesData, linesData] = await Promise.all([
                SchedulingService.getSchedules(),
                LineRegistrationService.getLines(),
            ]);
            setSchedules(schedulesData);
            setLines(linesData);
        } catch (err) {
            console.error("Failed to fetch scheduling data", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const addSchedule = async (data: ScheduleFormValues, userId: number | null) => {
        const created = await SchedulingService.createSchedule(data, userId);
        if (created) {
            await fetchData();
            return true;
        }
        return false;
    };

    const updateSchedule = async (id: number, data: ScheduleFormValues, current: ProductionSchedule, userId: number | null) => {
        const success = await SchedulingService.updateSchedule(id, data, current, userId);
        if (success) {
            await fetchData();
        }
        return success;
    };

    const removeSchedule = async (id: number, userId: number | null = null) => {
        const success = await SchedulingService.deleteSchedule(id, userId);
        if (success) {
            await fetchData();
            return true;
        }
        return false;
    };

    return React.createElement(
        SchedulingFetchContext.Provider,
        {
            value: {
                schedules,
                lines,
                isLoading,
                refetch: fetchData,
                addSchedule,
                updateSchedule,
                removeSchedule,
            },
        },
        children
    );
}

export function useSchedulingFetchContext() {
    const ctx = useContext(SchedulingFetchContext);
    if (!ctx) {
        throw new Error("Must be used inside SchedulingFetchProvider");
    }
    return ctx;
}
