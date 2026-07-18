/* eslint-disable */
"use client";

import React, { useMemo } from "react";
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
import type { ProductionSchedule } from "../../production-scheduling/types";
import { createColumns } from "./columns";

interface SummaryTableProps {
    data: ProductionSchedule[];
    isLoading?: boolean;
}

export function SummaryTable({
    data,
    isLoading = false,
}: SummaryTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([
        { id: "schedule_date", desc: true }
    ]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const columns = useMemo(() => createColumns(), []);

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
            <div className="space-y-4 animate-pulse">
                <div className="h-10 w-64 bg-muted/30 rounded-xl" />
                <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-4 p-4 border-b">
                            <div className="h-10 w-10 bg-muted/20 rounded-xl" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-48 bg-muted/20 rounded" />
                                <div className="h-3 w-32 bg-muted/10 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 flex flex-col h-full">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                    <Input
                        placeholder="Search by line name..."
                        value={(table.getColumn("line_name")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("line_name")?.setFilterValue(event.target.value)
                        }
                        className="pl-9 h-10 rounded-xl bg-muted/20 border-muted-foreground/10 focus-visible:ring-primary/20 backdrop-blur-sm transition-all text-xs font-medium"
                    />
                </div>
            </div>

            <div className="rounded-2xl border bg-card shadow-2xl shadow-primary/[0.02] overflow-hidden flex-1 flex flex-col">
                <div className="flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="bg-muted/10 sticky top-0 z-10 backdrop-blur-sm">
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
                                    <TableCell colSpan={columns.length} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2.5 py-6">
                                            <div className="bg-primary/5 p-3 rounded-2xl border border-dashed border-primary/10">
                                                <Inbox className="h-6 w-6 text-muted-foreground/45" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-xs font-black text-muted-foreground/50 uppercase tracking-widest">
                                                    No Schedules Found
                                                </p>
                                                <p className="text-[10px] text-muted-foreground/40 font-bold uppercase">
                                                    There are currently no records to display.
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                
                {/* Pagination footer */}
                <div className="border-t p-4 flex items-center justify-between bg-muted/5">
                    <div className="text-sm text-muted-foreground font-medium">
                        Showing {table.getFilteredRowModel().rows.length} total schedule(s)
                    </div>
                    <div className="space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            className="rounded-xl font-bold"
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                            className="rounded-xl font-bold"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
