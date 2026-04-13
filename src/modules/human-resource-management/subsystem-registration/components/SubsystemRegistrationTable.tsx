"use client";

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
import { SubsystemRegistration } from "../types";
import { createColumns } from "./columns";

interface SubsystemRegistrationTableProps {
    data: SubsystemRegistration[];
    onEdit: (subsystem: SubsystemRegistration) => void;
    onDelete: (subsystem: SubsystemRegistration) => void;
    onManageHierarchy: (subsystem: SubsystemRegistration) => void;
    onAdd: () => void;
    isLoading?: boolean;
}

export function SubsystemRegistrationTable({
    data,
    onEdit,
    onDelete,
    onManageHierarchy,
    onAdd,
    isLoading = false,
}: SubsystemRegistrationTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const columns = React.useMemo(() => createColumns(onEdit, onDelete, onManageHierarchy), [onEdit, onDelete, onManageHierarchy]);

    // eslint-disable-next-line react-hooks/incompatible-library
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
                <div className="h-10 bg-gray-200 rounded animate-pulse" />
                <div className="rounded-md border">
                    <div className="h-96 bg-gray-100 animate-pulse" />
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
                        placeholder="Quick search subsystems..."
                        value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("title")?.setFilterValue(event.target.value)
                        }
                        className="pl-9 h-10 rounded-xl bg-muted/20 border-muted-foreground/10 focus-visible:ring-primary/20 backdrop-blur-sm transition-all text-xs font-medium"
                    />
                </div>
                <Button 
                    onClick={onAdd}
                    className="h-10 rounded-xl px-6 font-black shadow-xl shadow-primary/20 bg-primary text-[10px] uppercase tracking-widest transition-all active:scale-95 gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Register Subsystem
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
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No subsystems registered.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end space-x-2">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} subsystem(s) registered
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
