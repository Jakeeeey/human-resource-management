/**
 * Division Table
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
import type { DivisionWithRelations, User, Department, BankAccount } from "../types";
import { createColumns } from "./columns";
import { DivisionToolbar } from "./DivisionToolbar";
import { DivisionDialog } from "./DivisionDialog";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

interface DivisionTableProps {
    data: DivisionWithRelations[];
    users: User[];
    departments: Department[];
    bankAccounts: BankAccount[];
    isLoading?: boolean;
    onCreateDivision: (data: Record<string, unknown>) => Promise<void>;
    onUpdateDivision: (id: number, data: Record<string, unknown>) => Promise<void>;
    onDeleteDivision: (id: number) => Promise<void>;
}

export function DivisionTable({
    data,
    users,
    departments,
    bankAccounts,
    isLoading = false,
    onCreateDivision,
    onUpdateDivision,
    onDeleteDivision,
}: DivisionTableProps) {


    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});

    const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [selectedDivision, setSelectedDivision] = React.useState<DivisionWithRelations | null>(null);

    const handleEdit = (division: DivisionWithRelations) => {
        setSelectedDivision(division);
        setEditDialogOpen(true);
    };

    const handleDelete = (division: DivisionWithRelations) => {
        setSelectedDivision(division);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (selectedDivision) {
            await onDeleteDivision(selectedDivision.division_id);
            setSelectedDivision(null);
        }
    };

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
            <div className="flex items-center justify-between">
                <DivisionToolbar />
                <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Division
                </Button>
            </div>

            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} division(s) found
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
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No divisions found.
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

            <DivisionDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                users={users}
                departments={departments}
                bankAccounts={bankAccounts}
                onSubmit={onCreateDivision}
            />

            <DivisionDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                division={selectedDivision}
                users={users}
                departments={departments}
                bankAccounts={bankAccounts}
                onSubmit={async (data) => {
                    if (selectedDivision) {
                        await onUpdateDivision(selectedDivision.division_id, data);
                        setEditDialogOpen(false);
                        setSelectedDivision(null);
                    }
                }}
            />

            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                division={selectedDivision}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
