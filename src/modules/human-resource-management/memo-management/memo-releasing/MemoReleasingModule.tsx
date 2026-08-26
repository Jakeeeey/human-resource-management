"use client";

import React from "react";
import { Search, SendHorizontal } from "lucide-react";
import { MemoReleasingProvider } from "./providers/MemoReleasingProvider";
import { useMemoReleasing } from "./hooks/useMemoReleasing";
import { MemoReleasingTable } from "./components/MemoReleasingTable";
import { MemoReleasingDialog } from "./components/MemoReleasingDialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MemoSyncProgressDialog } from "./components/MemoSyncProgressDialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MemoReleasingContent = () => {
    const {
        memos,
        companies,
        isLoading,
        searchQuery,
        selectedMemo,
        isDetailsOpen,
        setIsDetailsOpen,
        alertDialogConfig,
        setAlertDialogConfig,
        handleSearch,
        handleViewDetails,
        handleRelease,
        issuedByFilter,
        setIssuedByFilter,
        targetCompanyFilter,
        setTargetCompanyFilter,

        // Progress dialog states
        isSyncModalOpen,
        activeMemoNo,
        localReleaseStatus,
        syncItems,
        retrySyncCompany,
        handleSyncModalClose
    } = useMemoReleasing();

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
            {/* Header section */}
            <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between md:gap-0">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-200/50 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
                        <SendHorizontal className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black tracking-tighter text-foreground leading-tight">Memo Releasing</h2>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">
                            Release approved memos to target companies.
                        </p>
                    </div>
                </div>
            </div>

            {/* Filter Section */}
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
                                onChange={(e) => handleSearch(e.target.value)}
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
                </div>
            </div>

            {/* Main Table view */}
            <MemoReleasingTable
                data={memos}
                companies={companies}
                onRelease={handleRelease}
                onView={handleViewDetails}
                isLoading={isLoading}
            />

            {/* Details Modal */}
            <MemoReleasingDialog
                open={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                memo={selectedMemo}
                companies={companies}
            />

            {/* Sync Progress Dialog */}
            <MemoSyncProgressDialog
                open={isSyncModalOpen}
                onOpenChange={handleSyncModalClose}
                memoNo={activeMemoNo}
                items={syncItems}
                onRetry={retrySyncCompany}
                localReleaseStatus={localReleaseStatus}
            />

            {/* Confirmation Alert Dialog */}
            <AlertDialog
                open={alertDialogConfig.open}
                onOpenChange={(open) => setAlertDialogConfig(prev => ({ ...prev, open }))}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertDialogConfig.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {alertDialogConfig.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant={alertDialogConfig.variant || "default"}
                            className={
                                alertDialogConfig.variant === "destructive"
                                    ? ""
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
                            }
                            onClick={async () => {
                                await alertDialogConfig.onConfirm();
                            }}
                        >
                            Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default function MemoReleasingModule() {
    return (
        <MemoReleasingProvider>
            <MemoReleasingContent />
        </MemoReleasingProvider>
    );
}
