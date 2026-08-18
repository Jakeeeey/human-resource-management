import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useProductionOutputFetch } from "../providers/fetchProvider";
import { ProductionOutputService } from "../services/ProductionOutputService";
import type { ProductionSchedule } from "../../production-scheduling/types";
import { decodeJwtPayload, COOKIE_NAME } from "@/lib/auth-utils";

function getUserIdFromCookie(): number | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp(`(^| )${COOKIE_NAME}=([^;]+)`));
    if (!match) return null;
    const token = match[2];
    const payload = decodeJwtPayload(token);
    return payload ? (payload.id || payload.user_id || payload.sub) as number : null;
}

export function useProductionOutput() {
    const { schedules, isLoading, refreshData } = useProductionOutputFetch();
    const [selectedSchedule, setSelectedSchedule] = useState<ProductionSchedule | null>(null);
    const [isUpdateOpen, setIsUpdateOpen] = useState(false);
    const [financeStats, setFinanceStats] = useState({ totalActualCost: 0, totalEstCost: 0, isLoading: false });

    useEffect(() => {
        const fetchFinance = async () => {
            const unposted = schedules.filter(s => !s.is_output_posted);
            if (unposted.length === 0) {
                setFinanceStats({ totalActualCost: 0, totalEstCost: 0, isLoading: false });
                return;
            }
            setFinanceStats(prev => ({ ...prev, isLoading: true }));
            try {
                let actual = 0;
                let est = 0;
                await Promise.all(unposted.map(async (schedule) => {
                    const logs = await ProductionOutputService.getScheduleAttendance(schedule.id);
                    const { actualCost, estCost } = ProductionOutputService.calculateScheduleCost(schedule, logs);
                    actual += actualCost;
                    est += estCost;
                }));
                setFinanceStats({ totalActualCost: actual, totalEstCost: est, isLoading: false });
            } catch {
                setFinanceStats(prev => ({ ...prev, isLoading: false }));
            }
        };
        fetchFinance();
    }, [schedules]);

    const handleUpdateActualProduce = async (id: number, actualProduce: number, isPosted: boolean) => {
        const userId = getUserIdFromCookie();
        const success = await ProductionOutputService.updateActualProduce(id, actualProduce, isPosted, userId);
        
        if (success) {
            toast.success("Actual output updated successfully");
            await refreshData();
            setIsUpdateOpen(false);
            setSelectedSchedule(null);
            return true;
        } else {
            toast.error("Failed to update actual output");
            return false;
        }
    };

    const promptUpdate = (schedule: ProductionSchedule) => {
        setSelectedSchedule(schedule);
        setIsUpdateOpen(true);
    };

    return {
        schedules,
        isLoading,
        selectedSchedule,
        isUpdateOpen,
        setIsUpdateOpen,
        promptUpdate,
        handleUpdateActualProduce,
        financeStats,
    };
}
