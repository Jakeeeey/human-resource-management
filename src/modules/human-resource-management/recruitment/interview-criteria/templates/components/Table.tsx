"use client";

import React from "react";
import type { Template, TemplateFormData } from "../types";
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
import { TemplateEditorDialog } from "./TemplateEditorDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

interface TemplateTableProps {
    data: Template[];
    isLoading?: boolean;
    onCreateTemplate: (data: TemplateFormData) => Promise<void>;
    onUpdateTemplate: (id: number, data: TemplateFormData) => Promise<void>;
    onDeleteTemplate: (id: number) => Promise<void>;
}

export function TemplateTable({
    data,
    isLoading = false,
    onCreateTemplate,
    onUpdateTemplate,
    onDeleteTemplate,
}: TemplateTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

    const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [selectedTemplate, setSelectedTemplate] = React.useState<Template | null>(null);

    const handleEdit = React.useCallback((template: Template) => {
        setSelectedTemplate(template);
        setEditDialogOpen(true);
    }, []);

    const handleDeleteRequest = React.useCallback((template: Template) => {
        setSelectedTemplate(template);
        setDeleteDialogOpen(true);
    }, []);

    const handleConfirmDelete = async () => {
        if (selectedTemplate) {
            await onDeleteTemplate(selectedTemplate.id);
            setDeleteDialogOpen(false);
            setSelectedTemplate(null);
        }
    };

    const columns = React.useMemo(
        () => createColumns(handleEdit, handleDeleteRequest),
        [handleEdit, handleDeleteRequest]
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

    const rowCount = table.getFilteredRowModel().rows.length;

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
                    New Template
                </Button>
            </div>

            <div className="text-sm text-muted-foreground">
                {rowCount} {rowCount === 1 ? "template" : "templates"} found
            </div>

            <div className="rounded-md border overflow-x-auto">
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
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
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
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No templates found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </UiTable>
            </div>

            {rowCount > 0 && (
                <DataTablePagination
                    pageIndex={table.getState().pagination.pageIndex + 1}
                    pageSize={table.getState().pagination.pageSize}
                    rowCount={rowCount}
                    onPageChange={(page) => table.setPageIndex(page - 1)}
                    onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
                />
            )}

            <TemplateEditorDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onSubmit={onCreateTemplate}
            />

            <TemplateEditorDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                template={selectedTemplate}
                onSubmit={async (data) => {
                    if (selectedTemplate) {
                        await onUpdateTemplate(selectedTemplate.id, data);
                    }
                }}
            />

            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                template={selectedTemplate}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
