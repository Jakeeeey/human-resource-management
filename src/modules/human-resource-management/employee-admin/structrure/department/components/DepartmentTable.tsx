/**
 * Department Table
 * Updated with CRUD operations
 */

"use client";

import React from "react";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus } from "lucide-react";
import type { DepartmentWithRelations, Division, User } from "../types";
import { createColumns } from "./columns";
import { DepartmentToolbar } from "./DepartmentToolbar";
import { DepartmentDialog } from "./DepartmentDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

// ============================================================================
// COMPONENT
// ============================================================================

interface DepartmentTableProps {
    data: DepartmentWithRelations[];
    divisions: Division[];
    users: User[];
    isLoading?: boolean;
    onCreateDepartment: (data: Record<string, unknown>) => Promise<void>;
    onUpdateDepartment: (id: number, data: Record<string, unknown>) => Promise<void>;
    onDeleteDepartment: (id: number) => Promise<void>;
}

export function DepartmentTable({
    data,
    divisions,
    users,
    isLoading = false,
    onCreateDepartment,
    onUpdateDepartment,
    onDeleteDepartment,
}: DepartmentTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});

    // Dialog states
    const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [selectedDepartment, setSelectedDepartment] = React.useState<DepartmentWithRelations | null>(null);

    // Handle edit
    const handleEdit = (department: DepartmentWithRelations) => {
        setSelectedDepartment(department);
        setEditDialogOpen(true);
    };

    // Handle delete
    const handleDelete = (department: DepartmentWithRelations) => {
        setSelectedDepartment(department);
        setDeleteDialogOpen(true);
    };

    // Confirm delete
    const handleConfirmDelete = async () => {
        if (selectedDepartment) {
            await onDeleteDepartment(selectedDepartment.department_id);
            setDeleteDialogOpen(false);
            setSelectedDepartment(null);
        }
    };

    // Create columns with handlers
    const columns = React.useMemo(
        () => createColumns(handleEdit, handleDelete),
        []
    );

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-10 bg-gray-200 rounded animate-pulse" />
                <div className="rounded-md border">
                    <div className="h-96 bg-gray-100 animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <DepartmentToolbar divisions={divisions} />
                <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Department
                </Button>
            </div>

            {/* Table Controls */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} department(s) found
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="ml-auto">
                            Columns <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => {
                                return (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className="capitalize"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                    >
                                        {column.id}
                                    </DropdownMenuCheckboxItem>
                                );
                            })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
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
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No departments found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
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

            {/* Create Dialog */}
            <DepartmentDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                users={users}
                onSubmit={onCreateDepartment}
            />

            {/* Edit Dialog */}
            <DepartmentDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                department={selectedDepartment}
                users={users}
                onSubmit={async (data) => {
                    if (selectedDepartment) {
                        await onUpdateDepartment(selectedDepartment.department_id, data);
                    }
                }}
            />

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                department={selectedDepartment}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
