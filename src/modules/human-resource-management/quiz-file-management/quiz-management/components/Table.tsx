"use client";

import React from "react";
import type { Quiz, QuizFormData } from "../types";
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
import { QuizSettingsDialog } from "./QuizSettingsDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { ApplicantIntakeDialog } from "./ApplicantIntakeDialog";

interface QuizManagementTableProps {
    data: Quiz[];
    isLoading?: boolean;
    onCreateQuiz: (data: QuizFormData) => Promise<void>;
    onUpdateQuiz: (id: number, data: QuizFormData) => Promise<void>;
    onDeleteQuiz: (id: number) => Promise<void>;
}

export function QuizManagementTable({
    data,
    isLoading = false,
    onCreateQuiz,
    onUpdateQuiz,
    onDeleteQuiz,
}: QuizManagementTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});

    const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [intakeDialogOpen, setIntakeDialogOpen] = React.useState(false);
    const [selectedQuiz, setSelectedQuiz] = React.useState<Quiz | null>(null);
    const [quizToStart, setQuizToStart] = React.useState<Quiz | null>(null);

    const handleEdit = React.useCallback((quiz: Quiz) => {
        setSelectedQuiz(quiz);
        setEditDialogOpen(true);
    }, []);

    const handleDeleteRequest = React.useCallback((quiz: Quiz) => {
        setSelectedQuiz(quiz);
        setDeleteDialogOpen(true);
    }, []);

    const handleStartQuiz = React.useCallback((quiz: Quiz) => {
        setQuizToStart(quiz);
        setIntakeDialogOpen(true);
    }, []);

    const handleConfirmDelete = async () => {
        if (selectedQuiz) {
            await onDeleteQuiz(selectedQuiz.id);
            setDeleteDialogOpen(false);
            setSelectedQuiz(null);
        }
    };

    const columns = React.useMemo(
        () => createColumns(handleEdit, handleDeleteRequest, handleStartQuiz),
        [handleEdit, handleDeleteRequest, handleStartQuiz]
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
        onRowSelectionChange: setRowSelection,
        state: { sorting, columnFilters, columnVisibility, rowSelection },
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

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Toolbar />
                <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Quiz
                </Button>
            </div>

            <div className="text-sm text-muted-foreground">
                {table.getFilteredRowModel().rows.length} quiz(zes) found
            </div>

            <div className="rounded-md border overflow-x-auto">
                <UiTable className="min-w-[800px]">
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
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
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
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No quizzes found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </UiTable>
            </div>

            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} of{" "}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
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

            <QuizSettingsDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onSubmit={onCreateQuiz}
            />

            <QuizSettingsDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                quiz={selectedQuiz}
                onSubmit={async (data) => {
                    if (selectedQuiz) {
                        await onUpdateQuiz(selectedQuiz.id, data);
                    }
                }}
            />

            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                quiz={selectedQuiz}
                onConfirm={handleConfirmDelete}
            />

            <ApplicantIntakeDialog
                open={intakeDialogOpen}
                onOpenChange={setIntakeDialogOpen}
                quiz={quizToStart}
            />
        </div>
    );
}
