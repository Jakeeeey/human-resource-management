"use client";

import React, { useState, useMemo } from "react";
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    useReactTable,
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
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { UserSubsystemAccess } from "../types";
import { createColumns } from "./columns";
import { SubsystemRegistration } from "@/modules/human-resource-management/subsystem-registration/types";
import { TooltipProvider } from "@/components/ui/tooltip";

interface UserConfigurationTableProps {
    data: UserSubsystemAccess[];
    subsystems: SubsystemRegistration[];
    onToggleAccess: (userId: string, subsystemId: string | number, authorized: boolean) => void;
    onConfigure: (user: UserSubsystemAccess, subsystem: SubsystemRegistration) => void;
    isLoading?: boolean;
    isFirstLoad?: boolean;
    currentPage: number;
    totalCount: number;
    pageSize: number;
    searchTerm: string;
    onPageChange: (page: number, quiet?: boolean, search?: string) => void;
}

export function UserConfigurationTable({
    data,
    subsystems,
    onToggleAccess,
    onConfigure,
    isLoading = false,
    isFirstLoad = false,
    currentPage,
    totalCount,
    pageSize,
    searchTerm,
    onPageChange,
}: UserConfigurationTableProps) {
    // Local search state for input value
    const [searchInput, setSearchInput] = useState(searchTerm);

    // Debounce effect: trigger search after user stops typing
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput !== searchTerm) {
                onPageChange(0, false, searchInput);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchInput, searchTerm, onPageChange]);

    const columns = useMemo(() => createColumns(subsystems, onToggleAccess, onConfigure), [subsystems, onToggleAccess, onConfigure]);

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            pagination: {
                pageIndex: currentPage,
                pageSize: pageSize,
            },
        },
        manualPagination: true,
        pageCount: Math.ceil(totalCount / pageSize),
    });

    const totalPages = Math.ceil(totalCount / pageSize);

    if (isLoading && isFirstLoad) {
        return (
            <div className="space-y-4">
                <div className="h-12 bg-muted/20 rounded-2xl animate-pulse" />
                <div className="rounded-2xl border border-muted-foreground/10 overflow-hidden">
                    <div className="h-96 bg-muted/5 animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="space-y-6">
                <div className="flex items-center py-2 px-1">
                    <div className="relative w-full group/search">
                        {isLoading ? (
                            <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
                        ) : (
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within/search:text-primary transition-colors" />
                        )}
                        <Input
                            placeholder="Search users across all pages..."
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            className="max-w-full pl-11 h-12 bg-white/50 backdrop-blur-sm border-muted-foreground/20 rounded-2xl transition-all hover:border-primary/30 focus:border-primary focus:ring-4 focus:ring-primary/5 font-medium text-sm"
                        />
                    </div>
                </div>

                <div className="relative rounded-2xl border bg-card shadow-2xl shadow-primary/5 overflow-hidden">
                    <ScrollArea className="w-full">
                        <Table className={cn(
                            "relative border-separate border-spacing-0 min-w-full transition-all duration-300",
                            !isFirstLoad && isLoading && "opacity-40 grayscale-[0.5] pointer-events-none"
                        )}>
                            <TableHeader className="bg-muted/95 sticky top-0 z-10 backdrop-blur-md">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id} className="hover:bg-transparent border-b-muted-foreground/10">
                                        {headerGroup.headers.map((header, index) => (
                                            <TableHead 
                                                key={header.id} 
                                                className={cn(
                                                    "h-14 font-black text-center border-r-[1px] border-b-[1px] border-muted-foreground/10 last:border-r-0",
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
                                                        "py-3 border-r-[1px] border-b-[1px] border-muted-foreground/5 last:border-r-0 last:border-b-0",
                                                        index === 0 && "sticky left-0 bg-card z-20 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] border-r-2 border-primary/5"
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
