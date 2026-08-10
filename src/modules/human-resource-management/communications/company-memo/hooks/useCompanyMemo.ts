"use client";

import { useState, useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { useCompanyMemoContext } from "../providers/CompanyMemoProvider";
import { EnrichedCompanyMemo, CompanyMemoStatus, CompanyMemoPriority } from "../types/company-memo.schema";

export function useCompanyMemo() {
    const { memos, isLoading, error, refresh, submitMemo, updateMemo, deleteMemo } =
        useCompanyMemoContext();

    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedMemo, setSelectedMemo] = useState<EnrichedCompanyMemo | null>(null);
    const [statusFilter, setStatusFilter] = useState<CompanyMemoStatus | "ALL">("ALL");
    const [priorityFilter, setPriorityFilter] = useState<CompanyMemoPriority | "ALL">("ALL");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const filteredMemos = useMemo(() => {
        let result = memos;

        if (statusFilter !== "ALL") {
            result = result.filter((m) => m.status === statusFilter);
        }

        if (priorityFilter !== "ALL") {
            result = result.filter((m) => m.priority === priorityFilter);
        }

        if (dateRange?.from) {
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);
            result = result.filter((m) => {
                if (!m.created_at) return false;
                const d = new Date(m.created_at);
                return d >= from;
            });
        }

        if (dateRange?.to) {
            const to = new Date(dateRange.to);
            to.setHours(23, 59, 59, 999);
            result = result.filter((m) => {
                if (!m.created_at) return false;
                const d = new Date(m.created_at);
                return d <= to;
            });
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (m) =>
                    m.title.toLowerCase().includes(query) ||
                    m.content.toLowerCase().includes(query)
            );
        }

        return result;
    }, [memos, statusFilter, priorityFilter, dateRange, searchQuery]);

    const handleView = (memo: EnrichedCompanyMemo) => {
        setSelectedMemo(memo);
        setIsDetailOpen(true);
    };

    return {
        memos: filteredMemos,
        allMemos: memos,
        isLoading,
        error,
        refresh,
        isCreateOpen,
        setIsCreateOpen,
        isDetailOpen,
        setIsDetailOpen,
        selectedMemo,
        setSelectedMemo,
        statusFilter,
        setStatusFilter,
        priorityFilter,
        setPriorityFilter,
        dateRange,
        setDateRange,
        searchQuery,
        setSearchQuery,
        handleView,
        submitMemo,
        updateMemo,
        deleteMemo,
    };
}
