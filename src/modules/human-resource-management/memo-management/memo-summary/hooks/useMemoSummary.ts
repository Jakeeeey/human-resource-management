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
    const [issuedByFilter, setIssuedByFilter] = useState<string>("all");
    const [targetCompanyFilter, setTargetCompanyFilter] = useState<string>("all");
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
            // 1. Search Query
            let matchesSearch = true;
            if (searchQuery) {
                const q = searchQuery.toLowerCase().trim();
                const matchNo = memo.memo_no.toLowerCase().includes(q);
                const matchSubject = memo.subject?.toLowerCase().includes(q);
                matchesSearch = matchNo || !!matchSubject;
            }

            // 2. Status
            const matchesStatus = statusFilter === "All" || memo.status === statusFilter;

            // 3. Issued By
            let matchesIssuedBy = true;
            if (issuedByFilter && issuedByFilter !== "all") {
                matchesIssuedBy = String(memo.from) === issuedByFilter;
            }

            // 4. Target Companies
            let matchesTarget = true;
            if (targetCompanyFilter && targetCompanyFilter !== "all") {
                matchesTarget = memo.company_ids?.includes(Number(targetCompanyFilter)) || false;
            }

            return matchesSearch && matchesStatus && matchesIssuedBy && matchesTarget;
        });
    }, [memos, searchQuery, statusFilter, issuedByFilter, targetCompanyFilter]);

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
        issuedByFilter,
        setIssuedByFilter,
        targetCompanyFilter,
        setTargetCompanyFilter,
        handleSearchChange,
        handleStatusFilterChange,
        handleViewDetails,
        refreshMemos
    };
}
