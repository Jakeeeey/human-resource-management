"use client";

import React from "react";
import { Search, ClipboardCheck, X } from "lucide-react";
import { MemoAcknowledgementProvider } from "./providers/MemoAcknowledgementProvider";
import { useMemoAcknowledgement } from "./hooks/useMemoAcknowledgement";
import { MemoAcknowledgementTable } from "./components/MemoAcknowledgementTable";
import { MemoAcknowledgementDialog } from "./components/MemoAcknowledgementDialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";

const MemoAcknowledgementContent = () => {
    const {
        memos,
        companies,
        isLoading,
        searchQuery,
        selectedIssuedBy,
        setSelectedIssuedBy,
        selectedTargetCompany,
        setSelectedTargetCompany,
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

    // Reset all filters helper
    const hasActiveFilters = searchQuery || (selectedIssuedBy && selectedIssuedBy !== "all") || (selectedTargetCompany && selectedTargetCompany !== "all");
    const handleClearFilters = () => {
        handleSearchChange("");
        setSelectedIssuedBy("all");
        setSelectedTargetCompany("all");
    };

    // Filter Options
    const issuedByOptions = React.useMemo(() => {
        return [
            { value: "all", label: "All Issuers" },
            ...companies.map(c => ({
                value: String(c.company_id),
                label: `${c.company_name} (${c.company_code})`
            }))
        ];
    }, [companies]);

    const targetCompanyOptions = React.useMemo(() => {
        return [
            { value: "all", label: "All Target Companies" },
            ...companies.map(c => ({
                value: String(c.company_id),
                label: `${c.company_name} (${c.company_code})`
            }))
        ];
    }, [companies]);

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

            {/* Filter and Action Section */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-end w-full lg:w-auto flex-1">
                    {/* Search Bar */}
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
                            options={issuedByOptions}
                            value={selectedIssuedBy}
                            onValueChange={setSelectedIssuedBy}
                            placeholder="Select Issuer..."
                            className="h-10 bg-card shadow-sm w-full !block truncate text-left relative pr-8 [&_svg]:absolute [&_svg]:right-2 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
                        />
                    </div>

                    {/* Target Companies Filter */}
                    <div className="w-full sm:w-56 shrink-0 flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Target Companies</label>
                        <SearchableSelect
                            options={targetCompanyOptions}
                            value={selectedTargetCompany}
                            onValueChange={setSelectedTargetCompany}
                            placeholder="Select Target..."
                            className="h-10 bg-card shadow-sm w-full !block truncate text-left relative pr-8 [&_svg]:absolute [&_svg]:right-2 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
                        />
                    </div>
                </div>

                {hasActiveFilters && (
                    <div className="flex justify-start md:justify-end shrink-0">
                        <button
                            onClick={handleClearFilters}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/50 transition-all dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30 shadow-sm"
                        >
                            <X className="h-3.5 w-3.5" />
                            Clear All Filters
                        </button>
                    </div>
                )}
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

