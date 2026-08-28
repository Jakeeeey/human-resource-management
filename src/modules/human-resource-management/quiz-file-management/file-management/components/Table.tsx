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
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});

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
            <div className="flex items-center justify-between">
                <Toolbar />
                <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Question
                </Button>
            </div>

            <div className="text-sm text-muted-foreground">
                {table.getFilteredRowModel().rows.length} question(s) found
            </div>

            <div className="rounded-md border">
                <UiTable>
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
                                    No questions found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </UiTable>
            </div>

            <div className="flex items-center justify-end space-x-2">
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
