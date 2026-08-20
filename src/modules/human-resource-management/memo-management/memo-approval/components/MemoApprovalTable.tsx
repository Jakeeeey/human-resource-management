"use client";

import React from "react";
import { Paperclip, MoreVertical, Eye, Check, X } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { Memo, Company } from "../types";

interface MemoApprovalTableProps {
    data: Memo[];
    companies: Company[];
    selectedMemoNos: string[];
    onSelectRow: (memoNo: string) => void;
    onSelectAll: (checked: boolean) => void;
    onApprove: (memoNos: string[]) => void;
    onReject: (memoNos: string[]) => void;
    onView: (memo: Memo) => void;
    isLoading: boolean;
}

export function MemoApprovalTable({
    data,
    companies,
    selectedMemoNos,
    onSelectRow,
    onSelectAll,
    onApprove,
    onReject,
    onView,
    isLoading
}: MemoApprovalTableProps) {
    const isAllSelected = data.length > 0 && selectedMemoNos.length === data.length;

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
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card overflow-hidden shadow-lg shadow-slate-100/30 dark:shadow-none">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50/75 dark:bg-slate-900/60 font-semibold border-b">
                        <TableHead className="w-12 text-center py-4">
                            <Checkbox
                                checked={isAllSelected}
                                onCheckedChange={(checked) => onSelectAll(!!checked)}
                                disabled={isLoading || data.length === 0}
                            />
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Memo No.</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Issued By</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Target Companies</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Subject</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Active Period</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Status</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, idx) => (
                            <TableRow key={idx} className="border-b border-slate-100/60 dark:border-slate-800/50">
                                <TableCell className="py-4 text-center">
                                    <div className="h-4 w-4 bg-muted/70 rounded animate-pulse mx-auto" />
                                </TableCell>
                                <TableCell className="py-4">
                                    <div className="h-4 w-24 bg-muted/70 rounded-md animate-pulse" />
                                </TableCell>
                                <TableCell className="py-4">
                                    <div className="h-4 w-32 bg-muted/70 rounded-md animate-pulse" />
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
                                <TableCell className="py-4 text-right">
                                    <div className="h-8 w-8 bg-muted/70 rounded-full animate-pulse ml-auto" />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="h-24 text-center">
                                No submitted memos awaiting approval.
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((memo) => {
                            const isSelected = selectedMemoNos.includes(memo.memo_no);
                            const fromComp = companies.find(c => Number(c.company_id) === Number(memo.from));
                            const fromLabel = fromComp ? `${fromComp.company_name} (${fromComp.company_code})` : `Company #${memo.from}`;
                            
                            const targetComps = memo.company_ids?.map(id => {
                                const c = companies.find(c => Number(c.company_id) === Number(id));
                                return c ? c.company_code : `#${id}`;
                            }) || [];
                            const maxTargets = 2;
                            const targetDisplay = targetComps.slice(0, maxTargets).join(", ");
                            const remaining = targetComps.length - maxTargets;

                            const hasAttachments = memo.attachments && memo.attachments.length > 0;

                            return (
                                <TableRow key={memo.id} className={`${isSelected ? "bg-accent/40" : "hover:bg-accent/40"} transition-colors border-b border-slate-100/60 dark:border-slate-800/50`}>
                                    <TableCell className="text-center py-3.5">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => onSelectRow(memo.memo_no)}
                                        />
                                    </TableCell>
                                    <TableCell className="py-3.5 font-bold text-primary">{memo.memo_no}</TableCell>
                                    <TableCell className="py-3.5 max-w-[160px] truncate" title={fromLabel}>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
                                            {fromComp ? `${fromComp.company_code}` : `#${memo.from}`}
                                        </span>
                                    </TableCell>
                                    <TableCell className="py-3.5 max-w-[200px] truncate">
                                        <div className="flex items-center gap-1.5" title={targetComps.join(", ")}>
                                            {targetComps.length > 0 ? (
                                                <>
                                                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                                        {targetDisplay}
                                                    </span>
                                                    {remaining > 0 && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                            +{remaining}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-[11px] text-muted-foreground italic">None</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3.5 max-w-[240px]" title={memo.subject}>
                                        <div className="flex items-center gap-1.5">
                                            <span className="truncate font-medium">{memo.subject}</span>
                                            {hasAttachments && (
                                                <span title={`${memo.attachments?.length || 0} attachments`}>
                                                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3.5 font-medium text-slate-600 dark:text-slate-400 text-xs">
                                        {formatDate(memo.start_date)} — {formatDate(memo.end_date)}
                                    </TableCell>
                                    <TableCell className="py-3.5">
                                        <div className="inline-flex">
                                            <StatusBadge tone="info" className="font-semibold shadow-sm">
                                                {memo.status}
                                            </StatusBadge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3.5 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open actions menu</span>
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-36 bg-card text-card-foreground border rounded-md shadow-md p-1">
                                                <DropdownMenuItem onClick={() => onView(memo)} className="gap-2 focus:bg-accent focus:text-accent-foreground cursor-pointer">
                                                    <Eye className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
                                                    <span className="font-medium">View</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onApprove([memo.memo_no])} className="gap-2 focus:bg-accent focus:text-accent-foreground cursor-pointer">
                                                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                                    <span className="font-medium text-emerald-600">Approve</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onReject([memo.memo_no])} className="gap-2 text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950/20 cursor-pointer">
                                                    <X className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="font-medium">Reject</span>
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
    );
}
