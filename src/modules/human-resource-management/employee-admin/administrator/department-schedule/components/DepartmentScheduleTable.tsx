/**
 * Department Schedule Table
 * Complete table with CRUD operations
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
import type { DepartmentScheduleWithRelations, Department } from "../types";
import { createColumns } from "./columns";
import { DepartmentScheduleToolbar } from "./DepartmentScheduleToolbar";
import { DepartmentScheduleDialog } from "@/modules/human-resource-management/employee-admin/administrator/department-schedule/components/DepartmentScheduleDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

interface DepartmentScheduleTableProps {
    data: DepartmentScheduleWithRelations[];
    departments: Department[];
    isLoading?: boolean;
    onCreateSchedule: (data: Record<string, unknown>) => Promise<void>;
    onUpdateSchedule: (id: number, data: Record<string, unknown>) => Promise<void>;
    onDeleteSchedule: (id: number) => Promise<void>;
}

export function DepartmentScheduleTable({
    data,
    departments,
    isLoading = false,
    onCreateSchedule,
    onUpdateSchedule,
    onDeleteSchedule,
}: DepartmentScheduleTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});

    const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [selectedSchedule, setSelectedSchedule] = React.useState<DepartmentScheduleWithRelations | null>(null);

    const handleEdit = React.useCallback((schedule: DepartmentScheduleWithRelations) => {
        setSelectedSchedule(schedule);
        setEditDialogOpen(true);
    }, []);

    const handleDelete = React.useCallback((schedule: DepartmentScheduleWithRelations) => {
        setSelectedSchedule(schedule);
        setDeleteDialogOpen(true);
    }, []);

    const handleConfirmDelete = async () => {
        if (selectedSchedule) {
            await onDeleteSchedule(selectedSchedule.schedule_id);
            setSelectedSchedule(null);
        }
    };

    const columns = React.useMemo(
        () => createColumns(handleEdit, handleDelete),
        [handleEdit, handleDelete]
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
            <div className="flex items-center justify-between">
                <DepartmentScheduleToolbar />
                <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Schedule
                </Button>
            </div>

            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} schedule(s) found
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
                                    No schedules found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
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

            <DepartmentScheduleDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                departments={departments}
                onSubmit={onCreateSchedule}
            />

            <DepartmentScheduleDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                schedule={selectedSchedule}
                departments={departments}
                onSubmit={async (data) => {
                    if (selectedSchedule) {
                        await onUpdateSchedule(selectedSchedule.schedule_id, data);
                    }
                }}
            />

            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                schedule={selectedSchedule}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
