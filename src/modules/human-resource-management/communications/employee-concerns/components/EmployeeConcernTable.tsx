"use client";

import React from "react";
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    type SortingState,
    type ColumnFiltersState,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { EnrichedEmployeeConcern, ConcernStatus, CONCERN_STATUSES, CONCERN_STATUS_LABELS } from "../types/employee-concern.schema";
import { createColumns } from "./columns";

interface EmployeeConcernTableProps {
    concerns: EnrichedEmployeeConcern[];
    isLoading: boolean;
    error: string | null;
    statusFilter: ConcernStatus | "ALL";
    onStatusFilterChange: (value: ConcernStatus | "ALL") => void;
    onView: (concern: EnrichedEmployeeConcern) => void;
    onDelete: (concern: EnrichedEmployeeConcern) => void;
    onRefresh: () => void;
}

export function EmployeeConcernTable({
    concerns,
    isLoading,
    error,
    statusFilter,
    onStatusFilterChange,
    onView,
    onDelete,
    onRefresh,
}: EmployeeConcernTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const columns = React.useMemo(() => createColumns(onView, onDelete), [onView, onDelete]);

    // Apply the external status filter in-memory before handing data to TanStack.
    // The subject search still runs through columnFilters below.
    const filteredData = React.useMemo(
        () => (statusFilter === "ALL" ? concerns : concerns.filter((c) => c.status === statusFilter)),
        [concerns, statusFilter]
    );

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data: filteredData,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        initialState: { pagination: { pageSize: 10 } },
        state: { sorting, columnFilters },
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <Skeleton className="h-10 flex-1 max-w-sm rounded-xl" />
                    <Skeleton className="h-10 w-[180px] rounded-xl" />
                </div>
                <div className="rounded-2xl border overflow-hidden">
                    <Skeleton className="h-11 w-full rounded-none" />
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-none" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={onRefresh}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                    <Input
                        placeholder="Search subject or submitter..."
                        value={(table.getColumn("subject_of_concern")?.getFilterValue() as string) ?? ""}
                        onChange={(e) => table.getColumn("subject_of_concern")?.setFilterValue(e.target.value)}
                        className="pl-9 h-10 rounded-xl bg-muted/20 text-sm"
                    />
                </div>
                <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as ConcernStatus | "ALL")}>
                    <SelectTrigger className="h-10 w-full sm:w-[180px] rounded-xl">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All statuses</SelectItem>
                        {CONCERN_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                                {CONCERN_STATUS_LABELS[s]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/10">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="hover:bg-transparent border-b-muted-foreground/5">
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className="h-11 px-4 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70"
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="px-4">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                    No concerns found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end gap-2">
                <span className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} concern(s)
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="gap-1"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="gap-1"
                >
                    Next
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
