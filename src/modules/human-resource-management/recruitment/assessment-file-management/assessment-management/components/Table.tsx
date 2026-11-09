"use client";

import React from "react";
import type { Assessment, AssessmentFormData } from "../types";
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
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Plus } from "lucide-react";
import { createColumns } from "./columns";
import { Toolbar } from "./Toolbar";
import { AssessmentSettingsDialog } from "./AssessmentSettingsDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { ApplicantIntakeDialog } from "./ApplicantIntakeDialog";
import { useAssessmentManagementFilterContext } from "../providers/filterProvider";
import { pluralize } from "../../utils/pluralize";

interface ColumnMetaClasses {
    headerClassName?: string;
    cellClassName?: string;
}

interface AssessmentManagementTableProps {
    data: Assessment[];
    isLoading?: boolean;
    onCreateAssessment: (data: AssessmentFormData) => Promise<void>;
    onUpdateAssessment: (id: number, data: AssessmentFormData) => Promise<void>;
    onDeleteAssessment: (id: number) => Promise<void>;
}

export function AssessmentManagementTable({
    data,
    isLoading = false,
    onCreateAssessment,
    onUpdateAssessment,
    onDeleteAssessment,
}: AssessmentManagementTableProps) {
    const { filters, resetFilters } = useAssessmentManagementFilterContext();
    const hasActiveFilters = Boolean(filters.search) || filters.status != null;

    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

    const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [intakeDialogOpen, setIntakeDialogOpen] = React.useState(false);
    const [selectedAssessment, setSelectedAssessment] = React.useState<Assessment | null>(null);
    const [assessmentToStart, setAssessmentToStart] = React.useState<Assessment | null>(null);

    const handleEdit = React.useCallback((assessment: Assessment) => {
        setSelectedAssessment(assessment);
        setEditDialogOpen(true);
    }, []);

    const handleDeleteRequest = React.useCallback((assessment: Assessment) => {
        setSelectedAssessment(assessment);
        setDeleteDialogOpen(true);
    }, []);

    const handleStartAssessment = React.useCallback((assessment: Assessment) => {
        setAssessmentToStart(assessment);
        setIntakeDialogOpen(true);
    }, []);

    const handleConfirmDelete = async () => {
        if (selectedAssessment) {
            await onDeleteAssessment(selectedAssessment.id);
            setDeleteDialogOpen(false);
            setSelectedAssessment(null);
        }
    };

    const columns = React.useMemo(
        () => createColumns(handleEdit, handleDeleteRequest, handleStartAssessment),
        [handleEdit, handleDeleteRequest, handleStartAssessment]
    );

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

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Toolbar />
                <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Assessment
                </Button>
            </div>

            <div className="text-sm text-muted-foreground">
                {totalRows} {pluralize(totalRows, "assessment", "assessments")}
                {hasActiveFilters ? " match your filters" : ""}
            </div>

            <div className="rounded-md border overflow-x-auto">
                <UiTable className="w-full min-w-0 sm:min-w-[800px]">
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
                                                No assessments match your filters.
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
                                            No assessments yet. Use &ldquo;Add Assessment&rdquo; to create one.
                                        </span>
                                    )}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </UiTable>
            </div>

            {totalRows > 0 && (
                <DataTablePagination
                    pageIndex={table.getState().pagination.pageIndex + 1}
                    pageSize={table.getState().pagination.pageSize}
                    rowCount={totalRows}
                    onPageChange={(page) => table.setPageIndex(page - 1)}
                    onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
                />
            )}

            <AssessmentSettingsDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onSubmit={onCreateAssessment}
            />

            <AssessmentSettingsDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                assessment={selectedAssessment}
                onSubmit={async (data) => {
                    if (selectedAssessment) {
                        await onUpdateAssessment(selectedAssessment.id, data);
                    }
                }}
            />

            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                assessment={selectedAssessment}
                onConfirm={handleConfirmDelete}
            />

            <ApplicantIntakeDialog
                open={intakeDialogOpen}
                onOpenChange={setIntakeDialogOpen}
                assessment={assessmentToStart}
            />
        </div>
    );
}
