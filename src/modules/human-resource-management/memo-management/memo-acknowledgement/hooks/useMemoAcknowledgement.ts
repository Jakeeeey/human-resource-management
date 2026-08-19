import { useContext, useState, useMemo, useCallback } from "react";
import { MemoAcknowledgementContext } from "../providers/MemoAcknowledgementProvider";
import { Memo, CompanyAcknowledgement } from "../types";
import { MemoAcknowledgementService } from "../services/MemoAcknowledgementService";

export function useMemoAcknowledgement() {
    const context = useContext(MemoAcknowledgementContext);
    if (context === undefined) {
        throw new Error("useMemoAcknowledgement must be used within a MemoAcknowledgementProvider");
    }

    const { memos, companies, isLoading, refreshMemos } = context;

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [acknowledgementLogs, setAcknowledgementLogs] = useState<CompanyAcknowledgement[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    // Pagination states
    const [pageIndex, setPageIndex] = useState(0);
    const pageSize = 10;

    const handleSearchChange = useCallback((query: string) => {
        setSearchQuery(query);
        setPageIndex(0);
    }, []);

    // Load logs for a specific memo
    const fetchLogs = useCallback(async (memoNo: string) => {
        setIsLoadingLogs(true);
        try {
            const data = await MemoAcknowledgementService.getAcknowledgementLogs(memoNo);
            setAcknowledgementLogs(data);
        } catch (e) {
            console.error("Error fetching logs in hook:", e);
        } finally {
            setIsLoadingLogs(false);
        }
    }, []);

    const handleViewDetails = useCallback((memo: Memo) => {
        setSelectedMemo(memo);
        setIsDetailsOpen(true);
        setAcknowledgementLogs([]);
        fetchLogs(memo.memo_no);
    }, [fetchLogs]);

    const handleRetryCompanyLogs = useCallback(async (companyId: number) => {
        if (!selectedMemo) return;
        
        // Find if this company exists in logs and set its status to loading/retry
        setAcknowledgementLogs(prev => prev.map(log => 
            log.company_id === companyId 
                ? { ...log, status: "success", error: undefined, acknowledgements: undefined }
                : log
        ));

        try {
            const data = await MemoAcknowledgementService.getAcknowledgementLogs(selectedMemo.memo_no);
            setAcknowledgementLogs(data);
        } catch (e) {
            console.error("Retry logs failed:", e);
        }
    }, [selectedMemo]);

    // Filter logic
    const filteredMemos = useMemo(() => {
        return memos.filter((memo) => {
            return memo.memo_no
                .toLowerCase()
                .includes(searchQuery.toLowerCase().trim());
        });
    }, [memos, searchQuery]);

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
        selectedMemo,
        isDetailsOpen,
        setIsDetailsOpen,
        acknowledgementLogs,
        isLoadingLogs,
        pageIndex,
        pageCount,
        canPreviousPage,
        canNextPage,
        previousPage,
        nextPage,
        handleSearchChange,
        handleViewDetails,
        handleRetryCompanyLogs,
        refreshMemos
    };
}
