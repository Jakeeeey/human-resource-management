"use client";

import React from "react";
import { Search, ClipboardList } from "lucide-react";
import { MemoSummaryProvider } from "./providers/MemoSummaryProvider";
import { useMemoSummary } from "./hooks/useMemoSummary";
import { MemoSummaryTable } from "./components/MemoSummaryTable";
import { MemoSummaryDialog } from "./components/MemoSummaryDialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const MemoSummaryContent = () => {
    const {
        memos,
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
        totalFilteredCount,
        handleSearchChange,
        handleStatusFilterChange,
        handleViewDetails
    } = useMemoSummary();

    const statuses = ["All", "Draft", "Submitted", "Approved", "Released", "Rejected", "Archived"];

    return (
        <div className="flex-1 space-y-6 p-6 pt-8 h-full overflow-auto bg-gradient-to-br from-background via-background to-primary/[0.02]">
            {/* Header Section */}
            <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-0">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-200/50 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
                        <ClipboardList className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black tracking-tighter text-foreground leading-tight">Memo Summary</h2>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">
                            View history and summary logs of all company memos.
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

                    {/* Status Dropdown Filter */}
                    <div className="w-full sm:w-44">
                        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                            <SelectTrigger className="h-10 w-full bg-card">
                                <SelectValue placeholder="Filter by Status" />
                            </SelectTrigger>
                            <SelectContent className="bg-card text-card-foreground border rounded-md shadow-md">
                                {statuses.map((status) => (
                                    <SelectItem key={status} value={status} className="cursor-pointer focus:bg-accent focus:text-accent-foreground">
                                        {status === "All" ? "All Statuses" : status}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Memos Table */}
            <MemoSummaryTable
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

            {/* Details Dialog */}
            <MemoSummaryDialog
                open={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                memo={selectedMemo}
                companies={companies}
            />
        </div>
    );
};

export default function MemoSummaryModule() {
    return (
        <MemoSummaryProvider>
            <MemoSummaryContent />
        </MemoSummaryProvider>
    );
}
