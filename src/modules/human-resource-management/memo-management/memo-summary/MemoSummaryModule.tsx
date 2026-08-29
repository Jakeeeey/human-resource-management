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
import { SearchableSelect } from "@/components/ui/searchable-select";

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
        handleViewDetails,
        issuedByFilter,
        setIssuedByFilter,
        targetCompanyFilter,
        setTargetCompanyFilter
    } = useMemoSummary();

    const statuses = ["All", "Draft", "Submitted", "Approved", "Released", "Partially Released", "Rejected", "Archived", "Deleted"];

    const issuerOptions = React.useMemo(() => [
        { value: "all", label: "All Issuers" },
        ...companies.map(c => ({
            value: String(c.company_id),
            label: `${c.company_name} (${c.company_code})`
        }))
    ], [companies]);

    const targetOptions = React.useMemo(() => [
        { value: "all", label: "All Target Companies" },
        ...companies.map(c => ({
            value: String(c.company_id),
            label: `${c.company_name} (${c.company_code})`
        }))
    ], [companies]);

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
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-end w-full">
                    {/* Search Input */}
                    <div className="w-full sm:w-64 shrink-0 flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                                placeholder="Search no. or subject..."
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="pl-9 h-10 w-full bg-card shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Issued By Filter */}
                    <div className="w-full sm:w-56 shrink-0 flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Issued By</label>
                        <SearchableSelect
                            options={issuerOptions}
                            value={issuedByFilter}
                            onValueChange={setIssuedByFilter}
                            placeholder="Select Issuer..."
                            className="h-10 bg-card shadow-sm w-full !block truncate text-left relative pr-8 [&_svg]:absolute [&_svg]:right-2 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
                        />
                    </div>

                    {/* Target Companies Filter */}
                    <div className="w-full sm:w-56 shrink-0 flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Target Companies</label>
                        <SearchableSelect
                            options={targetOptions}
                            value={targetCompanyFilter}
                            onValueChange={setTargetCompanyFilter}
                            placeholder="Select Target..."
                            className="h-10 bg-card shadow-sm w-full !block truncate text-left relative pr-8 [&_svg]:absolute [&_svg]:right-2 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
                        />
                    </div>

                    {/* Status Dropdown Filter */}
                    <div className="w-full sm:w-44 shrink-0 flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Status</label>
                        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                            <SelectTrigger className="h-10 w-full bg-card shadow-sm">
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
