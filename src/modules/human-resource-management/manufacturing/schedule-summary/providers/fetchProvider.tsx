"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { SchedulingService } from "../../production-scheduling/services/SchedulingService";
import type { ProductionSchedule } from "../../production-scheduling/types";

interface ScheduleSummaryContextType {
    schedules: ProductionSchedule[];
    isLoading: boolean;
    refetch: () => Promise<void>;
}

const ScheduleSummaryContext = createContext<ScheduleSummaryContextType | undefined>(undefined);

export function ScheduleSummaryProvider({ children }: { children: React.ReactNode }) {
    const [schedules, setSchedules] = useState<ProductionSchedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await SchedulingService.getSchedules();
            setSchedules(data);
        } catch (error) {
            console.error("Failed to fetch schedules:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <ScheduleSummaryContext.Provider value={{ schedules, isLoading, refetch: fetchData }}>
            {children}
        </ScheduleSummaryContext.Provider>
    );
}

export function useScheduleSummaryContext() {
    const context = useContext(ScheduleSummaryContext);
    if (!context) {
        throw new Error("useScheduleSummaryContext must be used within ScheduleSummaryProvider");
    }
    return context;
}
