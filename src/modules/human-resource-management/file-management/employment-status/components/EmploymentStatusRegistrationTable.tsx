"use client";

import React from "react";
import type { EmploymentStatus, EmploymentStatusFormData } from "../types";
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
import { createColumns } from "./columns";
import { EmploymentStatusRegistrationToolbar } from "./EmploymentStatusRegistrationToolbar";
import { EmploymentStatusRegistrationDialog } from "./EmploymentStatusRegistrationDialog";
import { EmploymentStatusRegistrationViewDialog } from "./EmploymentStatusRegistrationViewDialog";

interface EmploymentStatusRegistrationTableProps {
    data: EmploymentStatus[];
    isLoading?: boolean;
    onCreateRecord: (data: EmploymentStatusFormData) => Promise<void>;
    onUpdateRecord: (id: number, data: EmploymentStatusFormData) => Promise<void>;
}

export function EmploymentStatusRegistrationTable({
    data,
    isLoading = false,
    onCreateRecord,
    onUpdateRecord,
}: EmploymentStatusRegistrationTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});

    const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [viewDialogOpen, setViewDialogOpen] = React.useState(false);
    const [selectedRecord, setSelectedRecord] =
        React.useState<EmploymentStatus | null>(null);

    const handleView = React.useCallback((record: EmploymentStatus) => {
        setSelectedRecord(record);
        setViewDialogOpen(true);
    }, []);

    const handleEdit = React.useCallback((record: EmploymentStatus) => {
        setSelectedRecord(record);
        setEditDialogOpen(true);
    }, []);


    const columns = React.useMemo(
        () => createColumns(handleView, handleEdit),
        [handleView, handleEdit]
    );

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        enableRowSelection: true,
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
                <EmploymentStatusRegistrationToolbar />
                <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Employment Status
                </Button>
            </div>

            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} employment status
                    {table.getFilteredRowModel().rows.length === 1 ? "" : "es"} found
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
                            .filter((col) => col.getCanHide())
                            .map((col) => (
                                <DropdownMenuCheckboxItem
                                    key={col.id}
                                    className="capitalize"
                                    checked={col.getIsVisible()}
                                    onCheckedChange={(val) =>
                                        col.toggleVisibility(!!val)
                                    }
                                >
                                    {col.id}
                                </DropdownMenuCheckboxItem>
                            ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="rounded-md border">
                <Table className="table-fixed">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className={
                                            header.column.id === "actions"
                                                ? "w-16 px-1"
                                                : undefined
                                        }
                                    >
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
                                    data-state={
                                        row.getIsSelected() && "selected"
                                    }
                                    onClick={row.getToggleSelectedHandler()}
                                    className="cursor-pointer"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={
                                                cell.column.id === "actions"
                                                    ? "w-16 px-1"
                                                    : undefined
                                            }
                                        >
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
                                    No employment statuses found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end space-x-2">
                <div className="flex-1 text-sm text-muted-foreground">
              
                    Showing {table.getFilteredRowModel().rows.length} of{" "}
                    {table.getFilteredRowModel().rows.length} row(s)
                    {" "}
                     of page{" "}
                    {table.getPageCount()}
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

            <EmploymentStatusRegistrationDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onSubmit={onCreateRecord}
            />

            <EmploymentStatusRegistrationDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                record={selectedRecord}
                onSubmit={async (data) => {
                    if (selectedRecord) {
                        await onUpdateRecord(selectedRecord.id, data);
                    }
                }}
            />

            <EmploymentStatusRegistrationViewDialog
                open={viewDialogOpen}
                onOpenChange={(open) => {
                    setViewDialogOpen(open);
                    if (!open) {
                        setSelectedRecord(null);
                    }
                }}
                record={selectedRecord}
            />
        </div>
    );
}
