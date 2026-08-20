import { useContext, useState, useMemo, useCallback } from "react";
import { MemoSummaryContext } from "../providers/MemoSummaryProvider";
import { Memo } from "../types";

export function useMemoSummary() {
    const context = useContext(MemoSummaryContext);
    if (context === undefined) {
        throw new Error("useMemoSummary must be used within a MemoSummaryProvider");
    }

    const { memos, companies, isLoading, refreshMemos } = context;

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Pagination states
    const [pageIndex, setPageIndex] = useState(0);
    const pageSize = 10;

    // Reset pagination when filter changes
    const handleSearchChange = useCallback((query: string) => {
        setSearchQuery(query);
        setPageIndex(0);
    }, []);

    const handleStatusFilterChange = useCallback((status: string) => {
        setStatusFilter(status);
        setPageIndex(0);
    }, []);

    const handleViewDetails = useCallback((memo: Memo) => {
        setSelectedMemo(memo);
        setIsDetailsOpen(true);
    }, []);

    // Filter logic
    const filteredMemos = useMemo(() => {
        return memos.filter((memo) => {
            const matchesSearch = memo.memo_no
                .toLowerCase()
                .includes(searchQuery.toLowerCase().trim());
            const matchesStatus =
                statusFilter === "All" || memo.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [memos, searchQuery, statusFilter]);

    // Paginated logic
    const paginatedMemos = useMemo(() => {
        const start = pageIndex * pageSize;
        const end = start + pageSize;
        return filteredMemos.slice(start, end);
    }, [filteredMemos, pageIndex]);

    const pageCount = Math.ceil(filteredMemos.length / pageSize) || 1;
    const canPreviousPage = pageIndex > 0;
    const canNextPage = pageIndex < pageCount - 1;

    const previousPage = useCallback(() => {
        if (canPreviousPage) setPageIndex((prev) => prev - 1);
    }, [canPreviousPage]);

    const nextPage = useCallback(() => {
        if (canNextPage) setPageIndex((prev) => prev + 1);
    }, [canNextPage]);

    return {
        memos: paginatedMemos,
        totalFilteredCount: filteredMemos.length,
        companies,
        isLoading,
        searchQuery,
        statusFilter,
        selectedMemo,
        isDetailsOpen,
        setIsDetailsOpen,
        pageIndex,
        pageCount,
        canPreviousPage,
        canNextPage,
        previousPage,
        nextPage,
        handleSearchChange,
        handleStatusFilterChange,
        handleViewDetails,
        refreshMemos
    };
}
