/* eslint-disable */
"use client";

import React, { useState } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    SortingState,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, InboxIcon } from "lucide-react";
import type { ProductionSchedule } from "../../production-scheduling/types";
import { getColumns } from "./columns";

interface OutputTableProps {
    data: ProductionSchedule[];
    onUpdateOutput: (schedule: ProductionSchedule) => void;
    isLoading: boolean;
}

export function OutputTable({ data, onUpdateOutput, isLoading }: OutputTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState("");
    const [lineFilter, setLineFilter] = useState<string>("all");
    const [dateFilter, setDateFilter] = useState<string>("");

    const columns = React.useMemo(() => getColumns(onUpdateOutput), [onUpdateOutput]);

    const filteredData = React.useMemo(() => {
        return data.filter(schedule => {
            const lineIdStr = typeof schedule.line_id === 'object' 
                ? String((schedule.line_id as any)?.id) 
                : String(schedule.line_id);
            
            if (lineFilter !== "all" && lineIdStr !== lineFilter) return false;
            if (dateFilter && schedule.schedule_date !== dateFilter) return false;
            return true;
        });
    }, [data, lineFilter, dateFilter]);

    const uniqueLines = React.useMemo(() => {
        const linesMap = new Map<number, string>();
        data.forEach(s => {
            if (s.line) {
                const lineId = typeof s.line_id === 'object' ? (s.line_id as any)?.id : s.line_id;
                if (lineId != null) {
                    linesMap.set(lineId, s.line.line_name);
                }
            }
        });
        return Array.from(linesMap.entries()).map(([id, name]) => ({ id, name }));
    }, [data]);

    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            globalFilter,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                        placeholder="Search schedules..."
                        value={globalFilter ?? ""}
                        onChange={(event) => setGlobalFilter(event.target.value)}
                        className="pl-10 h-11 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card font-medium shadow-sm transition-shadow hover:shadow-md"
                    />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Select value={lineFilter} onValueChange={setLineFilter}>
                        <SelectTrigger className="w-full sm:w-[180px] h-11 rounded-xl border-muted-foreground/10 bg-card font-medium shadow-sm">
                            <SelectValue placeholder="All Lines" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Lines</SelectItem>
                            {uniqueLines.map(line => (
                                <SelectItem key={line.id} value={line.id.toString()}>{line.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="h-11 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card font-medium shadow-sm w-full sm:w-auto"
                    />
                    {(lineFilter !== "all" || dateFilter) && (
                        <Button 
                            variant="ghost" 
                            onClick={() => { setLineFilter("all"); setDateFilter(""); }}
                            className="h-11 rounded-xl font-bold text-xs uppercase tracking-wider text-muted-foreground"
                        >
                            Clear
                        </Button>
                    )}
                </div>
            </div>

            <div className="rounded-2xl border bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/30">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="border-b-muted-foreground/10 hover:bg-transparent">
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className="h-11 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
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
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-48">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-3">
                                        <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                                        <span className="text-xs font-bold uppercase tracking-widest">Loading Records</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className="border-b-muted-foreground/10 hover:bg-muted/20 transition-colors"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="px-4 py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-3">
                                        <div className="bg-muted/30 p-4 rounded-full">
                                            <InboxIcon className="h-8 w-8 opacity-40" />
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-widest">No schedules found</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between px-2">
                <div className="flex-1 text-xs font-medium text-muted-foreground">
                    Showing {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length} schedules.
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="h-8 rounded-lg border-muted-foreground/20 font-bold text-xs shadow-sm"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="h-8 rounded-lg border-muted-foreground/20 font-bold text-xs shadow-sm"
                    >
                        Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
