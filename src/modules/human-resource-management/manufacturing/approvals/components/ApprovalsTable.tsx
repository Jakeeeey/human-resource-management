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
import { Search, Inbox } from "lucide-react";
import type { PendingApprovalItem } from "../types";
import { createColumns } from "./columns";

interface ApprovalsTableProps {
    data: PendingApprovalItem[];
    onApprove: (scheduleId: number) => void;
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

    const columns = React.useMemo(
        () => createColumns(onApprove, onReject),
        [onApprove, onReject]
    );

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
        </div>
    );
}
