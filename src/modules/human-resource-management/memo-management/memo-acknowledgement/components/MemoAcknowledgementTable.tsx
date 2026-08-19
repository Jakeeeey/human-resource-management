"use client";

import React from "react";
import { MoreVertical, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { Memo, Company } from "../types";

interface MemoAcknowledgementTableProps {
    data: Memo[];
    companies: Company[];
    onView: (memo: Memo) => void;
    isLoading: boolean;
    pageIndex: number;
    pageCount: number;
    canPreviousPage: boolean;
    canNextPage: boolean;
    previousPage: () => void;
    nextPage: () => void;
    totalCount: number;
}

export function MemoAcknowledgementTable({
    data,
    companies,
    onView,
    isLoading,
    pageIndex,
    pageCount,
    canPreviousPage,
    canNextPage,
    previousPage,
    nextPage,
    totalCount
}: MemoAcknowledgementTableProps) {

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return "-";
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            const [, y, m, d] = match;
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
        }
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString();
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card overflow-hidden shadow-lg shadow-slate-100/30 dark:shadow-none">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/75 dark:bg-slate-900/60 font-semibold border-b">
                            <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4 pl-6">Memo No.</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">From</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Subject</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Active Period</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Status</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4 pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, idx) => (
                                <TableRow key={idx} className="border-b border-slate-100/60 dark:border-slate-800/50">
                                    <TableCell className="py-4 pl-6">
                                        <div className="h-4 w-24 bg-muted/70 rounded-md animate-pulse" />
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="h-5 w-14 bg-muted/70 rounded-full animate-pulse" />
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="h-4 w-40 bg-muted/70 rounded-md animate-pulse" />
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="h-4 w-32 bg-muted/70 rounded-md animate-pulse" />
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="h-5 w-16 bg-muted/70 rounded-full animate-pulse" />
                                    </TableCell>
                                    <TableCell className="py-4 text-right pr-6">
                                        <div className="h-8 w-8 bg-muted/70 rounded-full animate-pulse ml-auto" />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground font-medium">
                                    No released memos awaiting acknowledgement.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((memo) => {
                                const fromComp = companies.find(c => Number(c.company_id) === Number(memo.from));
                                const fromLabel = fromComp ? `${fromComp.company_name} (${fromComp.company_code})` : `Company #${memo.from}`;

                                return (
                                    <TableRow 
                                        key={memo.id} 
                                        className="hover:bg-slate-50/30 dark:hover:bg-slate-900/20 transition-colors border-b border-slate-100/60 dark:border-slate-800/50"
                                    >
                                        <TableCell className="py-3.5 pl-6 font-bold text-primary">{memo.memo_no}</TableCell>
                                        <TableCell className="py-3.5 max-w-[160px] truncate" title={fromLabel}>
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
                                                {fromComp ? `${fromComp.company_code}` : `#${memo.from}`}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-3.5 max-w-[240px]" title={memo.subject}>
                                            <span className="truncate font-medium text-slate-700 dark:text-slate-300">{memo.subject}</span>
                                        </TableCell>
                                        <TableCell className="py-3.5 font-medium text-slate-600 dark:text-slate-400 text-xs">
                                            {formatDate(memo.start_date)} — {formatDate(memo.end_date)}
                                        </TableCell>
                                        <TableCell className="py-3.5">
                                            <div className="inline-flex">
                                                <StatusBadge tone="success" className="font-semibold shadow-sm">
                                                    {memo.status}
                                                </StatusBadge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3.5 text-right pr-6">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800">
                                                        <span className="sr-only">Open actions menu</span>
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-36 bg-card text-card-foreground border rounded-md shadow-md p-1">
                                                    <DropdownMenuItem onClick={() => onView(memo)} className="gap-2 focus:bg-accent focus:text-accent-foreground cursor-pointer">
                                                        <Eye className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
                                                        <span className="font-medium">View Logs</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls Floating Pill Panel */}
            {!isLoading && totalCount > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card border border-slate-200/60 dark:border-slate-800/80 p-3 px-5 rounded-2xl shadow-sm">
                    <div className="text-xs text-muted-foreground font-semibold order-2 sm:order-1 select-none">
                        Showing <span className="text-foreground font-bold">{data.length}</span> of <span className="text-foreground font-bold">{totalCount}</span> memos
                    </div>
                    <div className="flex items-center space-x-3 order-1 sm:order-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl border border-slate-200/60 bg-card hover:bg-primary hover:text-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-primary transition-colors disabled:opacity-40"
                            onClick={previousPage}
                            disabled={!canPreviousPage}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold min-w-[50px] text-center bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800 select-none">
                            {pageIndex + 1} / {pageCount}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl border border-slate-200/60 bg-card hover:bg-primary hover:text-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-primary transition-colors disabled:opacity-40"
                            onClick={nextPage}
                            disabled={!canNextPage}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
