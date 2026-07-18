"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { SchedulingService } from "../../production-scheduling/services/SchedulingService";
import type { ProductionSchedule } from "../../production-scheduling/types";

interface ProductionOutputFetchContextType {
    schedules: ProductionSchedule[];
    isLoading: boolean;
    refreshData: () => Promise<void>;
}

const ProductionOutputFetchContext = createContext<ProductionOutputFetchContextType | undefined>(undefined);

export function ProductionOutputFetchProvider({ children }: { children: ReactNode }) {
    const [schedules, setSchedules] = useState<ProductionSchedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refreshData = async () => {
        setIsLoading(true);
        try {
            const scheds = await SchedulingService.getSchedules();
            setSchedules(scheds);
        } catch (error) {
            console.error("Error fetching schedules:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, []);

    return (
        <ProductionOutputFetchContext.Provider value={{ schedules, isLoading, refreshData }}>
            {children}
        </ProductionOutputFetchContext.Provider>
    );
}

export function useProductionOutputFetch() {
    const context = useContext(ProductionOutputFetchContext);
    if (!context) {
        throw new Error("useProductionOutputFetch must be used within a ProductionOutputFetchProvider");
    }
    return context;
}
