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
import { Plus, Search } from "lucide-react";
import type { ProductionSchedule } from "../types";
import { createColumns } from "./columns";

interface SchedulingTableProps {
    data: ProductionSchedule[];
    onEdit: (schedule: ProductionSchedule) => void;
    onDelete: (id: number) => void;
    onApproveTarget: (id: number) => void;
    onApproveHeadcount: (posItemId: number) => void;
    onAdd: () => void;
    isLoading?: boolean;
}

export function SchedulingTable({
    data,
    onEdit,
    onDelete,
    onApproveTarget,
    onApproveHeadcount,
    onAdd,
    isLoading = false,
}: SchedulingTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const columns = React.useMemo(
        () => createColumns(onEdit, onDelete, onApproveTarget, onApproveHeadcount),
        [onEdit, onDelete, onApproveTarget, onApproveHeadcount]
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
                <div className="flex items-center justify-between gap-4">
                    <div className="h-10 w-64 bg-muted/30 rounded-xl animate-pulse" />
                    <div className="h-10 w-44 bg-primary/10 rounded-xl animate-pulse" />
                </div>
                <div className="rounded-2xl border bg-card shadow-2xl shadow-primary/[0.02] overflow-hidden">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-4 px-4 py-4 border-b border-muted-foreground/5 last:border-0"
                        >
                            <div className="h-10 w-10 rounded-xl bg-muted/20 animate-pulse" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-48 bg-muted/20 rounded animate-pulse" />
                                <div className="h-3 w-32 bg-muted/10 rounded animate-pulse" />
                            </div>
                            <div className="h-4 w-20 bg-muted/15 rounded animate-pulse" />
                            <div className="h-4 w-20 bg-muted/15 rounded animate-pulse" />
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
                        placeholder="Search schedules by date..."
                        value={(table.getColumn("schedule_date")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("schedule_date")?.setFilterValue(event.target.value)
                        }
                        className="pl-9 h-10 rounded-xl bg-muted/20 border-muted-foreground/10 focus-visible:ring-primary/20 backdrop-blur-sm transition-all text-xs font-medium"
                    />
                </div>
                <Button
                    onClick={onAdd}
                    className="h-10 rounded-xl px-6 font-black shadow-xl shadow-primary/20 bg-primary text-[10px] uppercase tracking-widest transition-all active:scale-95 gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Create Schedule
                </Button>
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
                                <TableCell colSpan={columns.length} className="h-24 text-center text-xs font-bold text-muted-foreground/50 uppercase tracking-wider">
                                    No schedules configured.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end space-x-2">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} schedule(s) registered
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
