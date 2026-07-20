import { useState } from "react";
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
    };
}
