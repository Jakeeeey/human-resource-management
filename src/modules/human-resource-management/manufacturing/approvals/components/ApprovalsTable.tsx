"use client";
/* eslint-disable react-hooks/incompatible-library */

import React from "react";
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnFiltersState,
    type SortingState,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Inbox, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import type { PendingApprovalItem } from "../types";
import { createColumns } from "./columns";

interface ApprovalsTableProps {
    data: PendingApprovalItem[];
    onApprove: (scheduleId: number, overrides?: { approved_target: number, approved_headcounts: { position_item_id: number; position_name: string; assigned: number }[] }) => void;
    onReject: (scheduleId: number) => void;
    isLoading?: boolean;
}

export function ApprovalsTable({
    data,
    onApprove,
    onReject,
    isLoading = false,
}: ApprovalsTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [warningDialogState, setWarningDialogState] = React.useState<{ 
        isOpen: boolean; 
        scheduleId: number; 
        suggestedTarget: number;
        currentTarget: number;
        targetLaborCost: number;
        baseTotalRate: number;
        positions: { position_name: string; assigned: number; allowed: number; position_item_id: number; position_rate: number; }[];
    }>({
        isOpen: false,
        scheduleId: 0,
        suggestedTarget: 0,
        currentTarget: 0,
        targetLaborCost: 0,
        baseTotalRate: 0,
        positions: []
    });

    const [overrides, setOverrides] = React.useState<{
        target: number;
        headcounts: Record<number, number>;
    }>({ target: 0, headcounts: {} });

    const columns = React.useMemo(
        () => createColumns(
            onApprove, 
            onReject,
            (scheduleId, suggestedTarget, currentTarget, positions, targetLaborCost, baseTotalRate) => {
                setWarningDialogState({ isOpen: true, scheduleId, suggestedTarget, currentTarget, positions, targetLaborCost, baseTotalRate });
                const initialHeadcounts: Record<number, number> = {};
                positions.forEach(p => { initialHeadcounts[p.position_item_id] = p.assigned; });
                setOverrides({ target: currentTarget, headcounts: initialHeadcounts });
            }
        ),
        [onApprove, onReject]
    );

    const { dynamicSuggestedTarget, currentTotalRate } = React.useMemo(() => {
        if (!warningDialogState.isOpen || warningDialogState.targetLaborCost <= 0) {
            return {
                dynamicSuggestedTarget: warningDialogState.suggestedTarget,
                currentTotalRate: warningDialogState.baseTotalRate
            };
        }
        
        let currentTotalRate = warningDialogState.baseTotalRate || 0;
        
        warningDialogState.positions.forEach((pos) => {
            const count = overrides.headcounts[pos.position_item_id] !== undefined 
                ? overrides.headcounts[pos.position_item_id] 
                : pos.assigned;
            const diff = count - pos.assigned;
            currentTotalRate += (diff * (pos.position_rate || 0));
        });
        
        currentTotalRate = Math.max(0, currentTotalRate);
        
        return {
            dynamicSuggestedTarget: Math.ceil(currentTotalRate / warningDialogState.targetLaborCost),
            currentTotalRate
        };
    }, [overrides.headcounts, warningDialogState]);

    const isBudgetMet = React.useMemo(() => {
        return (overrides.target || 0) >= dynamicSuggestedTarget;
    }, [overrides.target, dynamicSuggestedTarget]);

    const dynamicLaborCostPerPcs = React.useMemo(() => {
        const target = overrides.target || warningDialogState.currentTarget;
        return target > 0 ? currentTotalRate / target : 0;
    }, [overrides.target, warningDialogState.currentTarget, currentTotalRate]);

    const budgetVariance = React.useMemo(() => {
        const target = overrides.target || warningDialogState.currentTarget;
        const budget = warningDialogState.targetLaborCost * target;
        return budget - currentTotalRate;
    }, [overrides.target, warningDialogState.currentTarget, currentTotalRate, warningDialogState.targetLaborCost]);

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        initialState: {
            pagination: {
                pageSize: 50,
            },
        },
        state: {
            sorting,
            columnFilters,
        },
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-10 w-64 bg-muted/30 rounded-xl animate-pulse" />
                <div className="rounded-2xl border bg-card shadow-2xl shadow-primary/[0.02] overflow-hidden">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-4 px-4 py-4 border-b border-muted-foreground/5 last:border-0"
                        >
                            <div className="h-10 w-10 rounded-xl bg-muted/20 animate-pulse" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-48 bg-muted/20 rounded animate-pulse" />
                                <div className="h-3 w-32 bg-muted/10 rounded animate-pulse" />
                            </div>
                            <div className="flex gap-2">
                                <div className="h-7 w-20 rounded-xl bg-muted/10 animate-pulse" />
                                <div className="h-7 w-20 rounded-xl bg-muted/10 animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                    <Input
                        placeholder="Search approvals by line name..."
                        value={(table.getColumn("line_name")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("line_name")?.setFilterValue(event.target.value)
                        }
                        className="pl-9 h-10 rounded-xl bg-muted/20 border-muted-foreground/10 focus-visible:ring-primary/20 backdrop-blur-sm transition-all text-xs font-medium"
                    />
                </div>
            </div>

            <div className="rounded-2xl border bg-card shadow-2xl shadow-primary/[0.02] overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/10">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="hover:bg-transparent border-b-muted-foreground/5">
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className="h-11 px-4 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-32 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2.5 py-6">
                                        <div className="bg-primary/5 p-3 rounded-2xl border border-dashed border-primary/10">
                                            <Inbox className="h-6 w-6 text-muted-foreground/45" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-black text-muted-foreground/50 uppercase tracking-widest">
                                                All Clear
                                            </p>
                                            <p className="text-[10px] text-muted-foreground/40 font-bold uppercase">
                                                No daily schedules pending approval
                                            </p>
                                        </div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end space-x-2">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} pending request(s) found
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </div>

            {/* Over Budget Approval Warning Modal */}
            <Dialog 
                open={warningDialogState.isOpen} 
                onOpenChange={(open) => setWarningDialogState(prev => ({ ...prev, isOpen: open }))}
            >
                <DialogContent className="sm:max-w-[550px] rounded-2xl overflow-hidden p-0 border shadow-2xl">
                    <DialogHeader className={`p-6 pb-4 border-b transition-colors ${isBudgetMet ? 'bg-emerald-500/10 border-emerald-500/10' : 'bg-red-500/10 border-red-500/10'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-full ring-4 transition-colors ${isBudgetMet ? 'bg-emerald-500/20 ring-emerald-500/10' : 'bg-red-500/20 ring-red-500/10'}`}>
                                {isBudgetMet ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <AlertTriangle className="h-6 w-6 text-red-600" />}
                            </div>
                            <div>
                                <DialogTitle className={`text-lg font-black tracking-tighter transition-colors ${isBudgetMet ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {isBudgetMet ? 'Budget Requirements Met' : 'High Labor Cost Warning'}
                                </DialogTitle>
                                <DialogDescription className={`text-xs font-bold uppercase tracking-wider mt-0.5 transition-colors ${isBudgetMet ? 'text-emerald-600/80' : 'text-red-600/80'}`}>
                                    {isBudgetMet ? 'Within Standard Limits' : 'Budget Override Required'}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="p-6 space-y-4 bg-card max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <p className="text-sm text-foreground font-medium leading-relaxed">
                            {isBudgetMet ? (
                                <>The adjusted schedule is now <strong className="font-bold text-emerald-600">within the target labor cost budget</strong>.</>
                            ) : (
                                <>You are about to approve a schedule that <strong className="font-bold text-destructive">exceeds the target labor cost budget</strong>.</>
                            )}
                        </p>
                        
                        <div className={`p-4 rounded-xl border space-y-3 transition-colors ${isBudgetMet ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-muted/30 border-muted-foreground/10'}`}>
                            <p className="text-xs text-muted-foreground font-semibold">
                                The estimated labor cost per piece is significantly higher than the standard limit because the Daily Target is too low for the assigned headcounts.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-muted-foreground/10">
                                <div className="flex-1 space-y-1">
                                    <span className="text-[9px] uppercase font-black tracking-widest text-muted-foreground block">
                                        Target Limit
                                    </span>
                                    <span className="text-sm font-black text-foreground">
                                        ₱{warningDialogState.targetLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                    </span>
                                </div>
                                <div className="flex-1 space-y-1">
                                    <span className="text-[9px] uppercase font-black tracking-widest text-muted-foreground block">
                                        New Est. Cost/Pcs
                                    </span>
                                    <span className={`text-sm font-black ${isBudgetMet ? 'text-emerald-600' : 'text-destructive'}`}>
                                        ₱{dynamicLaborCostPerPcs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                    </span>
                                </div>
                                <div className="flex-1 space-y-1">
                                    <span className="text-[9px] uppercase font-black tracking-widest text-muted-foreground block">
                                        Suggested Target
                                    </span>
                                    <span className={`text-sm font-black ${isBudgetMet ? 'text-emerald-600' : 'text-destructive'}`}>
                                        {dynamicSuggestedTarget.toLocaleString()} pcs
                                    </span>
                                </div>
                                <div className="flex-1 space-y-1">
                                    <span className="text-[9px] uppercase font-black tracking-widest text-muted-foreground block">
                                        {budgetVariance >= 0 ? 'Saved Amount' : 'Over Budget'}
                                    </span>
                                    <span className={`text-sm font-black ${budgetVariance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                                        {budgetVariance >= 0 ? '+' : '-'}₱{Math.abs(budgetVariance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-6 pt-4 mt-4 border-t border-muted-foreground/10">
                            <div className="flex items-center gap-3 relative">
                                <div className="flex-[0.8] space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block text-center" title="Requested Target">
                                        Req. Target
                                    </label>
                                    <div className="h-12 flex items-center justify-center bg-muted/30 rounded-lg border border-muted-foreground/10 shadow-inner px-1">
                                        <span className="text-lg font-black tracking-tight text-muted-foreground/70 truncate">{warningDialogState.currentTarget.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="flex-[0.8] space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-orange-600/80 block text-center" title="Suggested Target (Based on Labor Cost)">
                                        Sugg. Target
                                    </label>
                                    <div className="h-12 flex items-center justify-center bg-orange-500/5 rounded-lg border border-orange-500/20 shadow-inner px-1 relative">
                                        <span className="text-lg font-black tracking-tight text-orange-600/80 truncate">{dynamicSuggestedTarget.toLocaleString()}</span>
                                        {dynamicSuggestedTarget !== warningDialogState.suggestedTarget && (
                                            <span className="absolute -top-2 -right-2 flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                {(() => {
                                    const original = warningDialogState.currentTarget;
                                    const current = overrides.target || 0;
                                    if (original === 0 || original === current) return null;
                                    const diff = current - original;
                                    const pct = (diff / original) * 100;
                                    const isPos = diff > 0;
                                    return (
                                        <div className="absolute left-[54%] top-9 -translate-x-1/2 -translate-y-1/2 z-10 bg-card border border-border shadow-sm rounded-full px-1.5 py-0.5 flex items-center justify-center">
                                            <span className={`text-[9px] font-black ${isPos ? 'text-emerald-600' : 'text-destructive'}`}>
                                                {isPos ? '+' : ''}{pct.toFixed(1)}%
                                            </span>
                                        </div>
                                    );
                                })()}

                                <div className="flex-1 space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center justify-center gap-2" title="New Approved Target">
                                        <span>New Target</span>
                                    </label>
                                    <Input 
                                        type="number"
                                        value={overrides.target || ""}
                                        onChange={(e) => setOverrides(prev => ({ ...prev, target: parseInt(e.target.value) || 0 }))}
                                        className="h-12 text-center text-lg font-black tracking-tight border-primary/20 bg-primary/5 focus-visible:ring-primary/20 px-2"
                                        placeholder="New target..."
                                    />
                                </div>
                            </div>
                            
                            {warningDialogState.positions.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            Approved Headcounts
                                        </label>
                                    </div>
                                    <div className="space-y-2 rounded-xl border bg-muted/10 p-3">
                                        <div className="flex items-center gap-2 px-2 pb-1">
                                            <span className="flex-[1.5] text-[9px] font-black uppercase tracking-widest text-muted-foreground">Position</span>
                                            <span className="w-10 text-center text-[9px] font-black uppercase tracking-widest text-orange-600/80" title="Suggested/Allowed Limit">Sugg</span>
                                            <span className="w-10 text-center text-[9px] font-black uppercase tracking-widest text-muted-foreground">Req</span>
                                            <span className="w-20 text-center text-[9px] font-black uppercase tracking-widest text-primary">New</span>
                                            <span className="w-12 text-center text-[9px] font-black uppercase tracking-widest text-muted-foreground">Diff</span>
                                        </div>
                                        {warningDialogState.positions.map((pos) => {
                                            const originalCount = pos.assigned;
                                            const newCount = overrides.headcounts[pos.position_item_id] || 0;
                                            let diffText = null;
                                            let isPos = false;
                                            if (originalCount > 0 && newCount !== originalCount) {
                                                const diff = newCount - originalCount;
                                                isPos = diff > 0;
                                                diffText = `${isPos ? '+' : ''}${((diff / originalCount) * 100).toFixed(0)}%`;
                                            } else if (originalCount === 0 && newCount > 0) {
                                                diffText = "+100%";
                                                isPos = true;
                                            }
                                            
                                            return (
                                                <div key={pos.position_item_id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border shadow-sm">
                                                    <span className="text-xs font-semibold text-foreground pl-1 truncate flex-[1.5]" title={pos.position_name}>{pos.position_name}</span>
                                                    <div className="w-10 flex items-center justify-center">
                                                        <span className="text-sm font-bold text-orange-600/80">{pos.allowed}</span>
                                                    </div>
                                                    <div className="w-10 flex items-center justify-center">
                                                        <span className="text-sm font-bold text-muted-foreground/70">{pos.assigned}</span>
                                                    </div>
                                                    <Input
                                                        type="number"
                                                        value={overrides.headcounts[pos.position_item_id] === undefined ? "" : overrides.headcounts[pos.position_item_id]}
                                                        onChange={(e) => setOverrides(prev => ({
                                                            ...prev,
                                                            headcounts: { ...prev.headcounts, [pos.position_item_id]: parseInt(e.target.value) || 0 }
                                                        }))}
                                                        className="h-9 w-20 font-black text-center border-primary/20 bg-primary/5 focus-visible:ring-primary/20 px-1"
                                                    />
                                                    <div className="w-12 flex items-center justify-center">
                                                        {diffText ? (
                                                            <span className={`text-[10px] font-black ${isPos ? 'text-emerald-600' : 'text-destructive'}`}>
                                                                {diffText}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-muted-foreground/30">-</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {isBudgetMet ? (
                            <p className="text-sm font-bold text-emerald-600 pt-2 text-center bg-emerald-500/10 p-2 rounded-lg">
                                ✓ The schedule is optimized and ready for approval.
                            </p>
                        ) : (
                            <p className="text-sm font-bold text-foreground pt-2">
                                Are you absolutely sure you want to approve this schedule despite the high costs?
                            </p>
                        )}
                    </div>

                    <DialogFooter className="p-4 bg-muted/20 border-t border-muted-foreground/5 gap-2 sm:gap-0">
                        <Button
                            variant="ghost"
                            onClick={() => setWarningDialogState(prev => ({ ...prev, isOpen: false }))}
                            className="rounded-xl px-6 font-black text-xs uppercase opacity-70 hover:opacity-100"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                const approved_headcounts = warningDialogState.positions.map(p => ({
                                    position_item_id: p.position_item_id,
                                    position_name: p.position_name,
                                    assigned: overrides.headcounts[p.position_item_id] || p.assigned
                                }));
                                
                                onApprove(warningDialogState.scheduleId, { 
                                    approved_target: overrides.target,
                                    approved_headcounts
                                });
                                setWarningDialogState(prev => ({ ...prev, isOpen: false }));
                            }}
                            className={`rounded-xl px-8 font-black text-white text-xs uppercase tracking-widest shadow-lg transition-all ${
                                isBudgetMet 
                                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' 
                                    : 'bg-destructive hover:bg-destructive/90 shadow-destructive/20'
                            }`}
                        >
                            {isBudgetMet ? 'Approve Schedule' : 'Approve Anyway'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
