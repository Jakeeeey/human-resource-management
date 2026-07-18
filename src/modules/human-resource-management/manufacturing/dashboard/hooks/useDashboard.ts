/* eslint-disable */
import { useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";
import type { DashboardStats, DashboardFilter } from "../types";
import { toast } from "sonner";

export function useDashboard() {
    const [filter, setFilter] = useState<DashboardFilter>(() => ({
        startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
        endDate: format(new Date(), "yyyy-MM-dd"),
        lineId: "all"
    }));

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [lines, setLines] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLines = useCallback(async () => {
        try {
            const res = await fetch('/api/hrm/manufacturing/lines');
            if (res.ok) {
                const data = await res.json();
                setLines(data.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch lines", err);
        }
    }, []);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const url = new URL('/api/hrm/manufacturing/dashboard', window.location.origin);
            url.searchParams.set('start_date', filter.startDate);
            url.searchParams.set('end_date', filter.endDate);
            if (filter.lineId && filter.lineId !== "all") {
                url.searchParams.set('line_id', filter.lineId);
            }
            const res = await fetch(url.toString());
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to fetch dashboard stats");
            }
            const data: DashboardStats = await res.json();
            setStats(data);
        } catch (err: any) {
            console.error("useDashboard fetch error:", err);
            setError(err.message);
            toast.error(err.message || "Failed to fetch dashboard stats");
        } finally {
            setIsLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchLines();
        fetchStats();
    }, [fetchStats, fetchLines]);

    const updateFilter = (newFilter: Partial<DashboardFilter>) => {
        setFilter(prev => ({ ...prev, ...newFilter }));
    };

    return {
        stats,
        lines,
        isLoading,
        error,
        filter,
        updateFilter,
        refresh: fetchStats
    };
}
