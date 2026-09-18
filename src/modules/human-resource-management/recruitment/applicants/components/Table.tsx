"use client";

import React from "react";
import {
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    type SortingState,
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
import { Badge } from "@/components/ui/badge";
import { Eye, Inbox, SearchX } from "lucide-react";
import { createColumns, getApplicantStatusColor } from "./columns";
import { Toolbar } from "./Toolbar";
import { useApplicants } from "../hooks/useApplicants";
import { useApplicantFilterContext } from "../providers/filterProvider";
import { APPLICANT_STATUS_LABELS, type ApplicantRow } from "../types";

interface ApplicantsTableProps {
    onSelect?: (row: ApplicantRow) => void;
}

export function ApplicantsTable({ onSelect }: ApplicantsTableProps) {
    const { applicants, isLoading } = useApplicants();
    const { filters, resetFilters } = useApplicantFilterContext();
    const [sorting, setSorting] = React.useState<SortingState>([]);

    const handleSelect = React.useCallback(
        (row: ApplicantRow) => {
            onSelect?.(row);
        },
        [onSelect]
    );

    const columns = React.useMemo(() => createColumns(handleSelect), [handleSelect]);

    // Filtering lives entirely in `useApplicants`; the table only sorts + paginates.
    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data: applicants,
        columns,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        state: { sorting },
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

    const rows = table.getRowModel().rows;
    const total = applicants.length;
    const hasActiveFilters = filters.search.trim() !== "" || filters.status !== null;
    const pageCount = table.getPageCount();
    const { pageIndex, pageSize } = table.getState().pagination;
    const showingFrom = total === 0 ? 0 : pageIndex * pageSize + 1;
    const showingTo = Math.min(total, pageIndex * pageSize + rows.length);

    const emptyState = (
        <div className="flex flex-col items-center justify-center gap-2 h-48 text-center text-muted-foreground">
            {hasActiveFilters ? (
                <SearchX className="h-10 w-10 text-muted-foreground/40" />
            ) : (
                <Inbox className="h-10 w-10 text-muted-foreground/40" />
            )}
            <p className="font-medium">
                {hasActiveFilters
                    ? "No applicants match your filters."
                    : "No applicants yet."}
            </p>
            {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                    Clear filters
                </Button>
            )}
        </div>
    );

    return (
        <div className="bg-card shadow-sm border border-border/50 rounded-xl p-4 sm:p-6 space-y-4">
            <Toolbar />

            {total > 0 && (
                <p className="text-sm text-muted-foreground">
                    Showing {showingFrom}–{showingTo} of {total}{" "}
                    {total === 1 ? "applicant" : "applicants"}
                </p>
            )}

            {/* Desktop: full table (Status + Actions visible without scroll) */}
            <div className="hidden sm:block rounded-xl border overflow-x-auto">
                <UiTable className="min-w-[640px]">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
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
                        {rows.length ? (
                            rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="p-0">
                                    {emptyState}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </UiTable>
            </div>

            {/* Mobile: stacked cards so Status + View stay reachable at 375–639px */}
            <div className="sm:hidden space-y-3">
                {rows.length ? (
                    rows.map((row) => {
                        const applicant = row.original;
                        const status = applicant.status;
                        return (
                            <div
                                key={row.id}
                                className="rounded-xl border border-border/60 p-4 space-y-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p
                                            className="font-medium truncate"
                                            title={applicant.full_name || "—"}
                                        >
                                            {applicant.full_name || "—"}
                                        </p>
                                        <p
                                            className="text-sm text-muted-foreground truncate"
                                            title={applicant.position_applied_for || "—"}
                                        >
                                            {applicant.position_applied_for || "—"}
                                        </p>
                                    </div>
                                    {status ? (
                                        <Badge
                                            variant="outline"
                                            className={`shrink-0 px-3 py-1.5 rounded-full font-bold uppercase tracking-wider ${getApplicantStatusColor(status)}`}
                                        >
                                            {APPLICANT_STATUS_LABELS[status]}
                                        </Badge>
                                    ) : (
                                        <span className="shrink-0 text-muted-foreground">—</span>
                                    )}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleSelect(applicant)}
                                >
                                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                                    View
                                </Button>
                            </div>
                        );
                    })
                ) : (
                    emptyState
                )}
            </div>

            {pageCount > 1 && (
                <div className="flex items-center justify-end gap-2">
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
            )}
        </div>
    );
}
