"use client";

import React from "react";
import type { QuizAttempt } from "../types";
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnFiltersState,
    type SortingState,
    type VisibilityState,
} from "@tanstack/react-table";
import {
    Table as UiTable,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { createColumns } from "./columns";
import { Toolbar } from "./Toolbar";
import { AnswerKeyDialog } from "./AnswerKeyDialog";
import { useQuizHistoryFilterContext } from "../providers/filterProvider";
import { pluralize } from "../../utils/pluralize";

interface ColumnMetaClasses {
    headerClassName?: string;
    cellClassName?: string;
}

interface QuizHistoryTableProps {
    data: QuizAttempt[];
    isLoading?: boolean;
}

export function QuizHistoryTable({ data, isLoading = false }: QuizHistoryTableProps) {
    const { filters, resetFilters } = useQuizHistoryFilterContext();
    const hasActiveFilters =
        Boolean(filters.search) || filters.quizId != null || filters.passed != null;

    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

    const [answerKeyOpen, setAnswerKeyOpen] = React.useState(false);
    const [selectedAttemptId, setSelectedAttemptId] = React.useState<number | null>(null);

    const handleViewDetails = React.useCallback((attempt: QuizAttempt) => {
        setSelectedAttemptId(attempt.id);
        setAnswerKeyOpen(true);
    }, []);

    const columns = React.useMemo(() => createColumns(handleViewDetails), [handleViewDetails]);

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
        onColumnVisibilityChange: setColumnVisibility,
        state: { sorting, columnFilters, columnVisibility },
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-10 bg-muted rounded animate-pulse" />
                <div className="rounded-md border">
                    <div className="h-96 bg-muted/50 animate-pulse" />
                </div>
            </div>
        );
    }

    const totalRows = table.getFilteredRowModel().rows.length;
    const { pageIndex, pageSize } = table.getState().pagination;
    const rangeStart = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
    const rangeEnd = Math.min((pageIndex + 1) * pageSize, totalRows);

    return (
        <div className="space-y-4">
            <Toolbar attempts={data} />

            <div className="text-sm text-muted-foreground">
                {totalRows} {pluralize(totalRows, "attempt")}
                {hasActiveFilters ? " match your filters" : ""}
            </div>

            <div className="rounded-md border overflow-x-auto">
                <UiTable className="w-full min-w-0 sm:min-w-[640px]">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    const meta = header.column.columnDef.meta as
                                        | ColumnMetaClasses
                                        | undefined;
                                    return (
                                        <TableHead key={header.id} className={meta?.headerClassName}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef.header,
                                                      header.getContext()
                                                  )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => {
                                        const meta = cell.column.columnDef.meta as
                                            | ColumnMetaClasses
                                            | undefined;
                                        return (
                                            <TableCell key={cell.id} className={meta?.cellClassName}>
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    {hasActiveFilters ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-muted-foreground">
                                                No attempts match your filters.
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={resetFilters}
                                            >
                                                Clear filters
                                            </Button>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground">
                                            No quiz attempts yet.
                                        </span>
                                    )}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </UiTable>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                <div className="flex-1 text-sm text-muted-foreground">
                    Showing {rangeStart}&ndash;{rangeEnd} of {totalRows}
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

            <AnswerKeyDialog
                open={answerKeyOpen}
                onOpenChange={setAnswerKeyOpen}
                attemptId={selectedAttemptId}
            />
        </div>
    );
}
