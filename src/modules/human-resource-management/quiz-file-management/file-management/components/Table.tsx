"use client";

import React from "react";
import type { QuizQuestionWithOptions, QuizQuestionFormData } from "../types";
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
import { Plus } from "lucide-react";
import { createColumns } from "./columns";
import { Toolbar } from "./Toolbar";
import { QuestionDialog } from "./QuestionDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { useFileManagementFilterContext } from "../providers/filterProvider";
import { pluralize } from "../../utils/pluralize";

interface ColumnMetaClasses {
    headerClassName?: string;
    cellClassName?: string;
}

interface FileManagementTableProps {
    data: QuizQuestionWithOptions[];
    isLoading?: boolean;
    onCreateQuestion: (data: QuizQuestionFormData) => Promise<void>;
    onUpdateQuestion: (id: number, data: QuizQuestionFormData) => Promise<void>;
    onDeleteQuestion: (id: number) => Promise<void>;
    onReactivateQuestion: (id: number) => Promise<void>;
}

export function FileManagementTable({
    data,
    isLoading = false,
    onCreateQuestion,
    onUpdateQuestion,
    onDeleteQuestion,
    onReactivateQuestion,
}: FileManagementTableProps) {
    const { filters, resetFilters } = useFileManagementFilterContext();
    const hasActiveFilters =
        Boolean(filters.search) ||
        filters.questionType != null ||
        filters.category != null ||
        filters.includeInactive;

    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

    const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [selectedQuestion, setSelectedQuestion] =
        React.useState<QuizQuestionWithOptions | null>(null);

    const handleEdit = React.useCallback((question: QuizQuestionWithOptions) => {
        setSelectedQuestion(question);
        setEditDialogOpen(true);
    }, []);

    const handleDeleteRequest = React.useCallback((question: QuizQuestionWithOptions) => {
        setSelectedQuestion(question);
        setDeleteDialogOpen(true);
    }, []);

    const handleConfirmDelete = async () => {
        if (selectedQuestion) {
            await onDeleteQuestion(selectedQuestion.id);
            setDeleteDialogOpen(false);
            setSelectedQuestion(null);
        }
    };

    const handleReactivate = React.useCallback(
        (question: QuizQuestionWithOptions) => {
            onReactivateQuestion(question.id);
        },
        [onReactivateQuestion]
    );

    const columns = React.useMemo(
        () => createColumns(handleEdit, handleDeleteRequest, handleReactivate),
        [handleEdit, handleDeleteRequest, handleReactivate]
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
    const { pageIndex, pageSize } = table.getState().pagination;
    const rangeStart = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
    const rangeEnd = Math.min((pageIndex + 1) * pageSize, totalRows);

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Toolbar />
                <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Question
                </Button>
            </div>

            <div className="text-sm text-muted-foreground">
                {totalRows} {pluralize(totalRows, "question")}
                {hasActiveFilters ? " match your filters" : ""}
            </div>

            <div className="rounded-md border overflow-x-auto">
                <UiTable className="w-full min-w-0 sm:min-w-[720px]">
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
                                                No questions match your filters.
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
                                            No questions yet. Use &ldquo;Add Question&rdquo; to add
                                            one.
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

            <QuestionDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onSubmit={onCreateQuestion}
            />

            <QuestionDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                question={selectedQuestion}
                onSubmit={async (data) => {
                    if (selectedQuestion) {
                        await onUpdateQuestion(selectedQuestion.id, data);
                    }
                }}
            />

            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                question={selectedQuestion}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
