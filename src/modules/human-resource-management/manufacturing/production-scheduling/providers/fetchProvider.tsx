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
    addSchedule: (data: ScheduleFormValues) => Promise<boolean>;
    updateSchedule: (id: number, data: ScheduleFormValues, current: ProductionSchedule) => Promise<boolean>;
    removeSchedule: (id: number) => Promise<boolean>;
    approveTarget: (id: number, userId: number | null) => Promise<boolean>;
    approveHeadcount: (posItemId: number, userId: number | null) => Promise<boolean>;
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

    const addSchedule = async (data: ScheduleFormValues) => {
        const created = await SchedulingService.createSchedule(data);
        if (created) {
            await fetchData();
            return true;
        }
        return false;
    };

    const updateSchedule = async (id: number, data: ScheduleFormValues, current: ProductionSchedule) => {
        const success = await SchedulingService.updateSchedule(id, data, current);
        if (success) {
            await fetchData();
        }
        return success;
    };

    const removeSchedule = async (id: number) => {
        const success = await SchedulingService.deleteSchedule(id);
        if (success) {
            await fetchData();
            return true;
        }
        return false;
    };

    const approveTarget = async (id: number, userId: number | null) => {
        const success = await SchedulingService.approveTarget(id, userId);
        if (success) {
            await fetchData();
        }
        return success;
    };

    const approveHeadcount = async (posItemId: number, userId: number | null) => {
        const success = await SchedulingService.approveHeadcount(posItemId, userId);
        if (success) {
            await fetchData();
        }
        return success;
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
                approveTarget,
                approveHeadcount,
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
