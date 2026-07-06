import { useState, useCallback } from "react";
import { StaffPayrollSummary } from "../types/logistics-payroll.schema";
import { fetchLogisticsPayroll, approveLogisticsPayroll } from "../services/logistics-payroll";

export function useLogisticsPayroll() {
    const [data, setData] = useState<StaffPayrollSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Current filter state
    const [cutoffStart, setCutoffStart] = useState<string | undefined>();
    const [cutoffEnd, setCutoffEnd] = useState<string | undefined>();

    const loadData = useCallback(async (start?: string, end?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetchLogisticsPayroll(start, end);
            setData(res.data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load logistics payroll");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const setCutoffFilters = (start?: string, end?: string) => {
        setCutoffStart(start);
        setCutoffEnd(end);
        loadData(start, end);
    };

    const approvePayroll = async (staffId: number, amount: number, dispatchDocNo: string, role?: string, areaName?: string, dispatchDate?: string) => {
        if (!cutoffStart || !cutoffEnd) {
            throw new Error("Cutoff dates must be set to approve payroll.");
        }
        setIsLoading(true);
        try {
            const descriptionParts = [];
            if (dispatchDate) {
                const dateParts = dispatchDate.split('T')[0].split('-');
                if (dateParts.length === 3) {
                    descriptionParts.push(`${dateParts[1]}/${dateParts[2]}`);
                } else {
                    descriptionParts.push(dispatchDate.split('T')[0]);
                }
            }
            if (areaName) descriptionParts.push(areaName);
            if (role) descriptionParts.push(role);
            const description = descriptionParts.length > 0 ? descriptionParts.join(" - ") : undefined;

            await approveLogisticsPayroll({
                user_id: staffId,
                amount: amount,
                cutoff_start: cutoffStart,
                cutoff_end: cutoffEnd,
                dispatchDocNo: dispatchDocNo,
                description: description
            });
            await loadData(cutoffStart, cutoffEnd);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to approve payroll");
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        data,
        isLoading,
        error,
        cutoffStart,
        cutoffEnd,
        setCutoffFilters,
        refresh: useCallback(() => loadData(cutoffStart, cutoffEnd), [loadData, cutoffStart, cutoffEnd]),
        approvePayroll,
    };
}
