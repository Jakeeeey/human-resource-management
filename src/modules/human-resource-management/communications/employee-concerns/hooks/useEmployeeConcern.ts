"use client";

import { useState, useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { useEmployeeConcernContext } from "../providers/EmployeeConcernProvider";
import { EnrichedEmployeeConcern, ConcernStatus } from "../types/employee-concern.schema";

export function useEmployeeConcern() {
    const { concerns, isLoading, error, refresh, updateStatus } =
        useEmployeeConcernContext();

    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedConcern, setSelectedConcern] = useState<EnrichedEmployeeConcern | null>(null);
    const [statusFilter, setStatusFilter] = useState<ConcernStatus | "ALL">("ALL");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [submittedByFilter, setSubmittedByFilter] = useState("");

    const filteredConcerns = useMemo(() => {
        let result = concerns;

        if (statusFilter !== "ALL") {
            result = result.filter((c) => c.status === statusFilter);
        }

        if (dateRange?.from) {
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);
            result = result.filter((c) => {
                if (!c.created_at) return false;
                const d = new Date(c.created_at);
                return d >= from;
            });
        }

        if (dateRange?.to) {
            const to = new Date(dateRange.to);
            to.setHours(23, 59, 59, 999);
            result = result.filter((c) => {
                if (!c.created_at) return false;
                const d = new Date(c.created_at);
                return d <= to;
            });
        }

        if (submittedByFilter.trim()) {
            result = result.filter((c) => {
                if (submittedByFilter === "__anonymous__") return c.is_anonymous;
                const id = c.user_id ?? c.created_by;
                return id != null && String(id) === submittedByFilter;
            });
        }

        return result;
    }, [concerns, statusFilter, dateRange, submittedByFilter]);

    const handleView = (concern: EnrichedEmployeeConcern) => {
        setSelectedConcern(concern);
        setIsDetailOpen(true);
    };

    const handleStatusUpdate = async (id: number, status: ConcernStatus): Promise<boolean> => {
        const ok = await updateStatus(id, status);
        if (ok && selectedConcern?.id === id) {
            setSelectedConcern({ ...selectedConcern, status });
        }
        return ok;
    };

    return {
        concerns: filteredConcerns,
        allConcerns: concerns,
        isLoading,
        error,
        refresh,
        isDetailOpen,
        setIsDetailOpen,
        selectedConcern,
        statusFilter,
        setStatusFilter,
        dateRange,
        setDateRange,
        submittedByFilter,
        setSubmittedByFilter,
        handleView,
        handleStatusUpdate,
    };
}
