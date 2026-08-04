import { useState, useCallback } from "react";
import { StaffPayrollSummary } from "../types/logistics-payroll.schema";
import { fetchLogisticsPayroll, approveLogisticsPayroll, updateLogisticsPayroll } from "../services/logistics-payroll";

export function useLogisticsPayroll() {
    const [data, setData] = useState<StaffPayrollSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Current filter state
    const [searchQuery, setSearchQuery] = useState("");
    const [cutoffStart, setCutoffStart] = useState<string | undefined>();
    const [cutoffEnd, setCutoffEnd] = useState<string | undefined>();
    const [showPendingOnly, setShowPendingOnly] = useState(false);

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
                const d = new Date(dispatchDate);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                descriptionParts.push(`${mm}/${dd}`);
            }
            if (areaName) descriptionParts.push(areaName);
            if (role) descriptionParts.push(role);
            const description = `Dispatch - ${dispatchDocNo}` + (descriptionParts.length > 0 ? ` - ${descriptionParts.join(" - ")}` : "");

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

    const updatePayroll = async (id: number, amount: number) => {
        setIsLoading(true);
        try {
            await updateLogisticsPayroll({ id, amount });
            await loadData(cutoffStart, cutoffEnd);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update payroll");
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
        searchQuery,
        setSearchQuery,
        setCutoffFilters,
        showPendingOnly,
        setShowPendingOnly,
        refresh: useCallback(() => loadData(cutoffStart, cutoffEnd), [loadData, cutoffStart, cutoffEnd]),
        approvePayroll,
        updatePayroll,
    };
}
