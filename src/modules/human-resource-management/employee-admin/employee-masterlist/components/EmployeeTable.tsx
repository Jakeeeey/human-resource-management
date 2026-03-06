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
import { ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal, Users } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { User, Department } from "../types";
import { createColumns } from "./columns";

interface EmployeeTableProps {
    data: User[];
    departments?: Department[];
    isLoading?: boolean;
    onViewDetails?: (employee: User) => void;
    onDeleteEmployee?: (id: number) => Promise<void>;
}

export function EmployeeTable({ 
    data, 
    departments = [],
    isLoading = false,
    onViewDetails,
    onDeleteEmployee
}: EmployeeTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});

    const handleViewDetails = React.useCallback((user: User) => {
        if (onViewDetails) {
            onViewDetails(user);
        }
    }, [onViewDetails]);

    const handleDelete = React.useCallback(async (user: User) => {
        if (onDeleteEmployee) {
            await onDeleteEmployee(user.id);
        }
    }, [onDeleteEmployee]);

    const columns = React.useMemo(() => createColumns(handleViewDetails, handleDelete, departments), [handleViewDetails, handleDelete, departments]);

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
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    });

    if (isLoading) {
        return (
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="h-10 w-[250px] bg-muted animate-pulse rounded-xl" />
                    <div className="h-10 w-[120px] bg-muted animate-pulse rounded-xl" />
                </div>
                <div className="rounded-2xl border h-[500px] bg-muted/5 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    <div className="relative w-full sm:w-[300px] group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Find an employee..."
                            value={(table.getColumn("full_name")?.getFilterValue() as string) ?? ""}
                            onChange={(event) =>
                                table.getColumn("full_name")?.setFilterValue(event.target.value)
                            }
                            className="pl-10 h-11 bg-muted/40 border-transparent focus:bg-background transition-all rounded-xl focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                    
                    <Select
                        value={(table.getColumn("department")?.getFilterValue() as string) ?? "all"}
                        onValueChange={(value) => 
                            table.getColumn("department")?.setFilterValue(value === "all" ? "" : value)
                        }
                    >
                        <SelectTrigger className="h-11 w-full sm:w-[220px] rounded-xl bg-muted/40 border-transparent focus:bg-background transition-all focus:ring-2 focus:ring-primary/20">
                            <SelectValue placeholder="All Departments" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-xl border-muted/20">
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.map((dept) => (
                                <SelectItem key={dept.department_id} value={dept.department_id.toString()}>
                                    {dept.department_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <Button variant="outline" size="sm" className="h-11 gap-2 rounded-xl border-dashed px-4 hover:border-primary/50 hover:bg-primary/5 ml-auto sm:ml-0">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Advanced</span>
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-10 ml-auto gap-2 rounded-xl px-4 hover:bg-muted/80">
                                Columns <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px] rounded-xl shadow-xl border-muted/20">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => {
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize py-2 rounded-lg m-1"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                        >
                                            {column.id.replace("user_", "").replace("_", " ")}
                                        </DropdownMenuCheckboxItem>
                                    );
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="rounded-2xl border bg-background overflow-hidden ring-1 ring-muted/10">
                <Table>
                    <TableHeader className="bg-muted/30">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="hover:bg-transparent border-b-muted/20">
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} className="h-12 px-6">
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
                                    className="hover:bg-primary/5 transition-colors border-b-muted/10 group h-16"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="px-6 py-3">
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
                                    className="h-40 text-center"
                                >
                                    <div className="flex flex-col items-center gap-2 opacity-60">
                                        <Users className="h-10 w-10 text-muted-foreground" />
                                        <p className="text-sm font-medium">No employee records found matching your criteria</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between px-2 gap-4 pt-2">
                <div className="text-sm text-muted-foreground font-medium order-2 sm:order-1">
                    Showing <span className="text-foreground">{table.getFilteredRowModel().rows.length}</span> verified personnel
                </div>
                <div className="flex items-center space-x-3 order-1 sm:order-2 bg-muted/20 p-1.5 rounded-2xl border border-muted/10">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl hover:bg-background"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-xs font-bold px-3 tabular-nums">
                        {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl hover:bg-background"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
