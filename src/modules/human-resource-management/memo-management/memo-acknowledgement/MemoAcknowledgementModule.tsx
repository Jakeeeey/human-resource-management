"use client";

import React from "react";
import { Search, ClipboardCheck } from "lucide-react";
import { MemoAcknowledgementProvider } from "./providers/MemoAcknowledgementProvider";
import { useMemoAcknowledgement } from "./hooks/useMemoAcknowledgement";
import { MemoAcknowledgementTable } from "./components/MemoAcknowledgementTable";
import { MemoAcknowledgementDialog } from "./components/MemoAcknowledgementDialog";
import { Input } from "@/components/ui/input";

const MemoAcknowledgementContent = () => {
    const {
        memos,
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
        totalFilteredCount,
        handleSearchChange,
        handleViewDetails,
        handleRetryCompanyLogs
    } = useMemoAcknowledgement();

    return (
        <div className="flex-1 space-y-6 p-6 pt-8 h-full overflow-auto bg-gradient-to-br from-background via-background to-primary/[0.02]">
            {/* Header Section */}
            <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-0">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 border border-violet-200/50 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800 shadow-sm">
                        <ClipboardCheck className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black tracking-tighter text-foreground leading-tight">Memo Acknowledgement</h2>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">
                            Track target company acknowledgements of released memos.
                        </p>
                    </div>
                </div>
            </div>

            {/* Filter Section */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-3 items-center w-full sm:w-auto">
                    {/* Search Input */}
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search memo number..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-9 h-10 w-full"
                        />
                    </div>
                </div>
            </div>

            {/* Memos Table */}
            <MemoAcknowledgementTable
                data={memos}
                companies={companies}
                onView={handleViewDetails}
                isLoading={isLoading}
                pageIndex={pageIndex}
                pageCount={pageCount}
                canPreviousPage={canPreviousPage}
                canNextPage={canNextPage}
                previousPage={previousPage}
                nextPage={nextPage}
                totalCount={totalFilteredCount}
            />

            {/* Acknowledgements Detail Dialog */}
            <MemoAcknowledgementDialog
                open={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                memo={selectedMemo}
                companies={companies}
                acknowledgementLogs={acknowledgementLogs}
                isLoadingLogs={isLoadingLogs}
                onRetryCompanyLogs={handleRetryCompanyLogs}
            />
        </div>
    );
};

export default function MemoAcknowledgementModule() {
    return (
        <MemoAcknowledgementProvider>
            <MemoAcknowledgementContent />
        </MemoAcknowledgementProvider>
    );
}
