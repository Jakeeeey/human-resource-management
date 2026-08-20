"use client";

import React from "react";
import { Plus, Edit2, Trash2, Paperclip, MoreVertical, Send, Eye } from "lucide-react";
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
import { StatusBadge, StatusTone } from "@/components/ui/status-badge";
import { Memo, Company } from "../types";

interface MemoCreationTableProps {
    data: Memo[];
    companies: Company[];
    onAdd: () => void;
    onEdit: (memo: Memo) => void;
    onView: (memo: Memo) => void;
    onDelete: (memo: Memo) => void;
    onSubmitMemo: (memo: Memo) => void;
    isLoading: boolean;
}

export function MemoCreationTable({ data, companies, onAdd, onEdit, onView, onDelete, onSubmitMemo, isLoading }: MemoCreationTableProps) {
    const getStatusTone = (status: string): StatusTone => {
        switch (status) {
            case "Approved":
            case "Active":
                return "success";
            case "Submitted":
                return "info";
            case "Archived":
            case "Rejected":
                return "destructive";
            case "Draft":
            default:
                return "neutral";
        }
    };

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
            <div className="flex justify-end">
                <Button onClick={onAdd} className="gap-2 rounded-xl">
                    <Plus className="h-4 w-4" /> Add Memo
                </Button>
            </div>
            {/* Table Container Card */}
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-card overflow-hidden shadow-lg shadow-slate-100/30 dark:shadow-none">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/75 dark:bg-slate-900/60 font-semibold border-b">
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
                                    <TableCell className="py-4">
                                        <div className="h-4 w-24 bg-muted/70 rounded-md animate-pulse" />
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="h-5 w-14 bg-muted/70 rounded-full animate-pulse" />
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="h-5 w-24 bg-muted/70 rounded-md animate-pulse" />
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
                                <TableCell colSpan={7} className="h-24 text-center">
                                    No memos found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((memo) => {
                                const fromComp = companies.find(c => Number(c.company_id) === Number(memo.from));
                                const fromLabel = fromComp ? `${fromComp.company_name} (${fromComp.company_code})` : `Company #${memo.from}`;
                                const hasAttachments = memo.attachments && memo.attachments.length > 0;
                                
                                return (
                                    <TableRow key={memo.id} className="hover:bg-accent/40 transition-colors border-b border-slate-100/60 dark:border-slate-800/50">
                                        <TableCell className="py-3.5 font-bold text-primary">{memo.memo_no}</TableCell>
                                        <TableCell className="py-3.5 max-w-[160px] truncate" title={fromLabel}>
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
                                                {fromComp ? `${fromComp.company_code}` : `#${memo.from}`}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-3.5 max-w-[200px]">
                                            <div className="flex flex-wrap gap-1 items-center">
                                                {memo.company_ids && memo.company_ids.length > 0 ? (
                                                    memo.company_ids.slice(0, 2).map((id) => {
                                                        const comp = companies.find(c => Number(c.company_id) === Number(id));
                                                        return (
                                                            <span key={id} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" title={comp ? comp.company_name : `Company #${id}`}>
                                                                {comp ? comp.company_code : `#${id}`}
                                                            </span>
                                                        );
                                                    })
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">-</span>
                                                )}
                                                {memo.company_ids && memo.company_ids.length > 2 && (
                                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 pl-0.5 cursor-help" title={memo.company_ids.map(id => {
                                                        const comp = companies.find(c => Number(c.company_id) === Number(id));
                                                        return comp ? comp.company_name : `Company #${id}`;
                                                    }).join(", ")}>
                                                        +{memo.company_ids.length - 2} more
                                                    </span>
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
                                                <StatusBadge tone={getStatusTone(memo.status)} className="font-semibold shadow-sm">
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
                                                    {memo.status === "Draft" || memo.status === "Rejected" ? (
                                                        <>
                                                            <DropdownMenuItem onClick={() => onSubmitMemo(memo)} className="gap-2 focus:bg-accent focus:text-accent-foreground cursor-pointer">
                                                                <Send className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                                                <span className="font-medium">Submit</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => onEdit(memo)} className="gap-2 focus:bg-accent focus:text-accent-foreground cursor-pointer">
                                                                <Edit2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                                                <span className="font-medium">Edit</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => onDelete(memo)} className="gap-2 text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950/20 cursor-pointer">
                                                                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                                                                <span className="font-medium">Delete</span>
                                                            </DropdownMenuItem>
                                                        </>
                                                    ) : (
                                                        <DropdownMenuItem onClick={() => onView(memo)} className="gap-2 focus:bg-accent focus:text-accent-foreground cursor-pointer">
                                                            <Eye className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400 shrink-0" />
                                                            <span className="font-medium">View</span>
                                                        </DropdownMenuItem>
                                                    )}
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
        </div>
    );
}
