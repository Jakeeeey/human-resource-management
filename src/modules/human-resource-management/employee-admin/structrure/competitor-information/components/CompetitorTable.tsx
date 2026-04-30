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

import type { Competitor, CompetitorFormData } from "../types";
import { createColumns } from "./columns";
import { CompetitorDialog } from "./CompetitorDialog";

interface CompetitorTableProps {
    data: Competitor[];
    isLoading?: boolean;
    onCreateCompetitor: (data: CompetitorFormData) => Promise<void>;
    onUpdateCompetitor: (id: number, data: CompetitorFormData) => Promise<void>;
}

export function CompetitorTable({
    data,
    isLoading = false,
    onCreateCompetitor,
    onUpdateCompetitor,
}: CompetitorTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

    const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [selectedCompetitor, setSelectedCompetitor] = React.useState<Competitor | null>(null);

    const handleEdit = React.useCallback((competitor: Competitor) => {
        setSelectedCompetitor(competitor);
        setEditDialogOpen(true);
    }, []);

    const columns = React.useMemo(() => createColumns(handleEdit), [handleEdit]);

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
        state: {
            sorting,
            columnFilters,
            columnVisibility,
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
                <div className="text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} competitor(s) found
                </div>
                <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Competitor
                </Button>
            </div>

            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Showing {table.getRowModel().rows.length} record(s)
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
                            .map((column) => (
                                <DropdownMenuCheckboxItem
                                    key={column.id}
                                    className="capitalize"
                                    checked={column.getIsVisible()}
                                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                >
                                    {column.id}
                                </DropdownMenuCheckboxItem>
                            ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="rounded-md border">
                <Table>
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
                                    No competitors found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end space-x-2">
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

            <CompetitorDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onSubmit={onCreateCompetitor}
            />

            <CompetitorDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                competitor={selectedCompetitor}
                onSubmit={async (data) => {
                    if (selectedCompetitor) {
                        await onUpdateCompetitor(selectedCompetitor.id, data);
                    }
                }}
            />
        </div>
    );
}
