"use client";

import React from "react";
import { Search, Check, X, FileCheck } from "lucide-react";
import { MemoApprovalProvider } from "./providers/MemoApprovalProvider";
import { useMemoApproval } from "./hooks/useMemoApproval";
import { MemoApprovalTable } from "./components/MemoApprovalTable";
import { MemoApprovalDialog } from "./components/MemoApprovalDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
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

const MemoApprovalContent = () => {
    const {
        memos,
        companies,
        isLoading,
        selectedMemoNos,
        searchQuery,
        selectedMemo,
        isDetailsOpen,
        setIsDetailsOpen,
        issuedByFilter,
        setIssuedByFilter,
        targetCompanyFilter,
        setTargetCompanyFilter,
        alertDialogConfig,
        setAlertDialogConfig,
        handleSearch,
        handleSelectRow,
        handleSelectAll,
        handleViewDetails,
        handleApprove,
        handleReject
    } = useMemoApproval();

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
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                        <FileCheck className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black tracking-tighter text-foreground leading-tight">Memo Approval</h2>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">
                            Review, approve, or reject submitted memos.
                        </p>
                    </div>
                </div>
            </div>

            {/* Filter and Bulk Action Section */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col md:flex-row gap-3 items-end w-full md:w-auto flex-1">
                    {/* Search Bar */}
                    <div className="w-full md:w-64 shrink-0 flex flex-col gap-1.5">
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
                    <div className="w-full md:w-56 shrink-0 flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Issued By</label>
                        <SearchableSelect
                            options={issuerOptions}
                            value={issuedByFilter}
                            onValueChange={setIssuedByFilter}
                            placeholder="Select Issuer..."
                            className="h-10 bg-card shadow-sm"
                        />
                    </div>

                    {/* Target Companies Filter */}
                    <div className="w-full md:w-56 shrink-0 flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Target Companies</label>
                        <SearchableSelect
                            options={targetOptions}
                            value={targetCompanyFilter}
                            onValueChange={setTargetCompanyFilter}
                            placeholder="Select Target..."
                            className="h-10 bg-card shadow-sm"
                        />
                    </div>
                </div>

                {/* Bulk Actions Indicator and Buttons */}
                {selectedMemoNos.length > 0 && (
                    <div className="flex items-center gap-3 bg-muted/60 border px-4 py-2 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                        <span className="text-xs font-bold text-muted-foreground">
                            {selectedMemoNos.length} Memo{selectedMemoNos.length > 1 ? "s" : ""} Selected
                        </span>
                        <div className="h-4 w-px bg-muted-foreground/25" />
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="default"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
                                onClick={() => handleApprove(selectedMemoNos)}
                            >
                                <Check className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                className="font-medium gap-1.5"
                                onClick={() => handleReject(selectedMemoNos)}
                            >
                                <X className="h-3.5 w-3.5" /> Reject
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Table view */}
            <MemoApprovalTable
                data={memos}
                companies={companies}
                selectedMemoNos={selectedMemoNos}
                onSelectRow={handleSelectRow}
                onSelectAll={handleSelectAll}
                onApprove={handleApprove}
                onReject={handleReject}
                onView={handleViewDetails}
                isLoading={isLoading}
            />

            {/* Details Modal */}
            <MemoApprovalDialog
                open={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                memo={selectedMemo}
                companies={companies}
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

export default function MemoApprovalModule() {
    return (
        <MemoApprovalProvider>
            <MemoApprovalContent />
        </MemoApprovalProvider>
    );
}
