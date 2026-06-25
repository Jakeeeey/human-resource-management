"use client";

import React from "react";
import type { DateRange } from "react-day-picker";
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
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Combobox,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxEmpty,
} from "@/components/ui/combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Search,
    AlertCircle,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    CalendarIcon,
    X,
} from "lucide-react";
import { cn, formatDateLong } from "@/lib/utils";
import { EnrichedEmployeeConcern, type ConcernStatus, CONCERN_STATUSES, CONCERN_STATUS_LABELS } from "../types/employee-concern.schema";
import { createColumns } from "./columns";

interface EmployeeConcernTableProps {
    concerns: EnrichedEmployeeConcern[];
    isLoading: boolean;
    error: string | null;
    statusFilter: ConcernStatus | "ALL";
    onStatusFilterChange: (value: ConcernStatus | "ALL") => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (range: DateRange | undefined) => void;
    submittedByFilter: string;
    onSubmittedByFilterChange: (value: string) => void;
    onView: (concern: EnrichedEmployeeConcern) => void;
    onRefresh: () => void;
}

export function EmployeeConcernTable({
    concerns,
    isLoading,
    error,
    statusFilter,
    onStatusFilterChange,
    dateRange,
    onDateRangeChange,
    submittedByFilter,
    onSubmittedByFilterChange,
    onView,
    onRefresh,
}: EmployeeConcernTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const columns = React.useMemo(() => createColumns(onView), [onView]);

    const submitterOptions = React.useMemo(() => {
        const seen = new Set<number | "anonymous">();
        const options: { value: string; label: string }[] = [];
        for (const c of concerns) {
            if (c.is_anonymous) {
                if (!seen.has("anonymous")) {
                    seen.add("anonymous");
                    options.push({ value: "__anonymous__", label: "Anonymous" });
                }
            } else {
                const id = c.user_id ?? c.created_by;
                if (id != null && !seen.has(id)) {
                    seen.add(id);
                    const name = c.user_name || c.created_by_name || `User #${id}`;
                    options.push({ value: String(id), label: name });
                }
            }
        }
        return options.sort((a, b) => a.label.localeCompare(b.label));
    }, [concerns]);
    const hasActiveFilters = statusFilter !== "ALL" || !!dateRange || submittedByFilter.length > 0;

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data: concerns,
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

    const clearAllFilters = () => {
        onStatusFilterChange("ALL");
        onDateRangeChange(undefined);
        onSubmittedByFilterChange("");
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <Skeleton className="h-10 flex-1 max-w-sm rounded-xl" />
                    <Skeleton className="h-10 w-[180px] rounded-xl" />
                    <Skeleton className="h-10 w-[240px] rounded-xl" />
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

    const dateRangeLabel = dateRange?.from
        ? dateRange.to
            ? `${formatDateLong(dateRange.from)} – ${formatDateLong(dateRange.to)}`
            : `From ${formatDateLong(dateRange.from)}`
        : "Date range";

    return (
        <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Subject search — left */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                    <Input
                        placeholder="Search subject..."
                        value={(table.getColumn("subject_of_concern")?.getFilterValue() as string) ?? ""}
                        onChange={(e) => table.getColumn("subject_of_concern")?.setFilterValue(e.target.value)}
                        className="pl-9 h-10 rounded-xl bg-muted/20 text-sm"
                    />
                </div>

                {/* Right-aligned filter controls */}
                <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
                    {/* Status filter */}
                    <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as ConcernStatus | "ALL")}>
                        <SelectTrigger className="h-10 w-full sm:w-[160px] rounded-xl">
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

                    {/* Submitted by filter — search + dropdown */}
                    <Combobox
                        items={submitterOptions}
                        value={submitterOptions.find((o) => o.value === submittedByFilter) ?? null}
                        onValueChange={(item: { value: string; label: string } | null) =>
                            onSubmittedByFilterChange(item?.value ?? "")
                        }
                    >
                        <ComboboxInput
                            className="h-10 w-full sm:w-[220px] rounded-xl text-sm"
                            placeholder="Submitted by..."
                            showClear={!!submittedByFilter}
                        />
                        <ComboboxContent>
                            <ComboboxEmpty>No matches.</ComboboxEmpty>
                            <ComboboxList>
                                {(item: { value: string; label: string }) => (
                                    <ComboboxItem key={item.value} value={item}>
                                        {item.label}
                                    </ComboboxItem>
                                )}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>

                    {/* Date range picker */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "h-10 w-full sm:w-[240px] rounded-xl justify-start text-left font-normal",
                                    !dateRange && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                <span className="truncate">{dateRangeLabel}</span>
                                {dateRange && (
                                    <X
                                        className="ml-auto h-4 w-4 shrink-0 opacity-60 hover:opacity-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDateRangeChange(undefined);
                                        }}
                                    />
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="range"
                                selected={dateRange}
                                onSelect={onDateRangeChange}
                                initialFocus
                                numberOfMonths={2}
                            />
                        </PopoverContent>
                    </Popover>

                    {/* Clear filters */}
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearAllFilters}
                            className="h-10 shrink-0 gap-1"
                        >
                            <X className="h-3.5 w-3.5" />
                            Clear
                        </Button>
                    )}
                </div>
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
