"use client";

import React, { useState, useMemo } from "react";
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
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
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { UserSubsystemAccess } from "../types";
import { createColumns } from "./columns";
import { SubsystemRegistration } from "@/modules/human-resource-management/subsystem-registration/types";
import { TooltipProvider } from "@/components/ui/tooltip";

interface UserConfigurationTableProps {
    data: UserSubsystemAccess[];
    subsystems: SubsystemRegistration[];
    onToggleAccess: (userId: string, subsystemId: string, authorized: boolean) => void;
    onConfigure: (user: UserSubsystemAccess, subsystem: SubsystemRegistration) => void;
    isLoading?: boolean;
    currentPage: number;
    totalCount: number;
    pageSize: number;
    onPageChange: (page: number) => void;
}

export function UserConfigurationTable({
    data,
    subsystems,
    onToggleAccess,
    onConfigure,
    isLoading = false,
    currentPage,
    totalCount,
    pageSize,
    onPageChange,
}: UserConfigurationTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    const columns = useMemo(() => createColumns(subsystems, onToggleAccess, onConfigure), [subsystems, onToggleAccess, onConfigure]);

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
    });

    const totalPages = Math.ceil(totalCount / pageSize);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-10 bg-gray-200 rounded-xl animate-pulse" />
                <div className="rounded-2xl border">
                    <div className="h-96 bg-gray-100 animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="relative group flex-1 max-sm">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
                        <Input
                            placeholder="Search users by name or email..."
                            value={(table.getColumn("full_name")?.getFilterValue() as string) ?? ""}
                            onChange={(event) =>
                                table.getColumn("full_name")?.setFilterValue(event.target.value)
                            }
                            className="pl-10 h-11 rounded-2xl bg-muted/20 border-muted-foreground/10 focus-visible:ring-primary/20 transition-all font-medium"
                        />
                    </div>
                </div>

                <div className="rounded-2xl border bg-card shadow-2xl shadow-primary/5 overflow-hidden">
                    <ScrollArea className="w-full">
                        <Table className="relative">
                            <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-md">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id} className="hover:bg-transparent border-b-muted-foreground/10">
                                        {headerGroup.headers.map((header, index) => (
                                            <TableHead 
                                                key={header.id} 
                                                className={cn(
                                                    "h-14 font-black text-center border-r-[1px] border-muted-foreground/10 last:border-r-0",
                                                    index === 0 && "sticky left-0 bg-muted/95 backdrop-blur-md z-30 border-r-2 border-primary/10 shadow-[2px_0_10px_-4px_rgba(0,0,0,0.1)]"
                                                )}
                                            >
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
                                        <TableRow key={row.id} className="hover:bg-primary/[0.01] transition-colors border-b-muted-foreground/5 last:border-b-0">
                                            {row.getVisibleCells().map((cell, index) => (
                                                <TableCell 
                                                    key={cell.id}
                                                    className={cn(
                                                        "py-3 border-r-[1px] border-muted-foreground/5 last:border-r-0",
                                                        index === 0 && "sticky left-0 bg-card z-20 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] border-r-2"
                                                    )}
                                                >
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={table.getAllColumns().length} className="h-40 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground/60">
                                                <Search className="h-10 w-10 mb-2 opacity-20" />
                                                <p className="font-bold">No matching users found.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>

                <div className="flex items-center justify-between bg-muted/10 p-4 rounded-3xl border border-muted-foreground/5">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md">{totalCount}</span>
                        Total Users Active
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 0}
                            className="rounded-xl px-4 font-bold text-xs gap-2"
                        >
                            Previous
                        </Button>
                        <div className="text-[10px] font-mono text-muted-foreground/60">
                            Page {currentPage + 1} of {Math.max(1, totalPages)}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage + 1 >= totalPages}
                            className="rounded-xl px-4 font-bold text-xs gap-2"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
