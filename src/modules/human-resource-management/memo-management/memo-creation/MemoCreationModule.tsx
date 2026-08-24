"use client";

import React from "react";
import { MemoFetchProvider } from "./providers/fetchProvider";
import { useMemoCreation } from "./hooks/useMemoCreation";
import { MemoCreationTable } from "./components/MemoCreationTable";
import { MemoCreationDialog } from "./components/MemoCreationDialog";
import { Search, FilePlus, X } from "lucide-react";
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

const MemoCreationContent = () => {
    const {
        memos,
        companies,
        isLoading,
        isDialogOpen,
        setIsDialogOpen,
        selectedMemo,
        isSubmitting,
        isReadOnly,
        alertDialogConfig,
        setAlertDialogConfig,
        handleAdd,
        handleEdit,
        handleView,
        handleDelete,
        handleSubmitMemo,
        handleSubmit,
        searchQuery,
        handleSearch,
        selectedIssuedBy,
        setSelectedIssuedBy,
        selectedTargetCompany,
        setSelectedTargetCompany
    } = useMemoCreation();

    // Reset all filters helper
    const hasActiveFilters = searchQuery || (selectedIssuedBy && selectedIssuedBy !== "all") || (selectedTargetCompany && selectedTargetCompany !== "all");
    const handleClearFilters = () => {
        handleSearch("");
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
        // Exclude the selected issued_by company from target company choices
        const filteredCompanies = selectedIssuedBy && selectedIssuedBy !== "all"
            ? companies.filter(c => Number(c.company_id) !== Number(selectedIssuedBy))
            : companies;

        return [
            { value: "all", label: "All Target Companies" },
            ...filteredCompanies.map(c => ({
                value: String(c.company_id),
                label: `${c.company_name} (${c.company_code})`
            }))
        ];
    }, [companies, selectedIssuedBy]);

    return (
        <div className="flex-1 space-y-6 p-6 pt-8 h-full overflow-auto bg-gradient-to-br from-background via-background to-primary/[0.02]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 border border-violet-200/50 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800">
                        <FilePlus className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black tracking-tighter text-foreground leading-tight">Memo Creation</h2>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">
                            Manage and create your memos.
                        </p>
                    </div>
                </div>
            </div>

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

                    {/* Issued By Dropdown */}
                    <div className="w-full md:w-56 shrink-0 flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Issued By</label>
                        <SearchableSelect
                            options={issuedByOptions}
                            value={selectedIssuedBy}
                            onValueChange={setSelectedIssuedBy}
                            placeholder="Select Issuer..."
                            className="h-10 bg-card shadow-sm w-full !block truncate text-left relative pr-8 [&_svg]:absolute [&_svg]:right-2 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
                        />
                    </div>

                    {/* Target Companies Dropdown */}
                    <div className="w-full md:w-56 shrink-0 flex flex-col gap-1.5">
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

            <MemoCreationTable
                data={memos}
                companies={companies}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onView={handleView}
                onDelete={handleDelete}
                onSubmitMemo={handleSubmitMemo}
                isLoading={isLoading}
            />

            <MemoCreationDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSubmit={handleSubmit}
                memo={selectedMemo}
                companies={companies}
                isSubmitting={isSubmitting}
                isReadOnly={isReadOnly}
            />

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

export default function MemoCreationModule() {
    return (
        <MemoFetchProvider>
            <MemoCreationContent />
        </MemoFetchProvider>
    );
}
