/* eslint-disable */
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
import { ChevronLeft, ChevronRight, Search, ScanFace, X, Users, ShieldCheck, Clock } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { User, Department } from "../types";
import { createColumns } from "./columns";

type EmployeeWithFace = User & { 
  hasFaceBiometric?: boolean; 
  image_reference_path?: string | null;
};

interface RegistryTableProps {
    data: EmployeeWithFace[];
    departments?: Department[];
    isLoading?: boolean;
    onScanFace?: (employee: EmployeeWithFace) => void;
    onRemoveBiometric?: (employee: EmployeeWithFace) => void;
}

export function RegistryTable({ 
    data, 
    departments = [],
    isLoading = false,
    onScanFace,
    onRemoveBiometric
}: RegistryTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

    const handleScanFace = React.useCallback((user: EmployeeWithFace) => {
        if (onScanFace) {
            onScanFace(user);
        }
    }, [onScanFace]);

    const handleRemoveBiometric = React.useCallback((user: EmployeeWithFace) => {
        if (onRemoveBiometric) {
            onRemoveBiometric(user);
        }
    }, [onRemoveBiometric]);

    const columns = React.useMemo(
        () => createColumns(handleScanFace, handleRemoveBiometric, departments), 
        [handleScanFace, handleRemoveBiometric, departments]
    );

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
    });

    const currentStatusFilter = (table.getColumn("status")?.getFilterValue() as string) ?? "all";
    const currentSearch = (table.getColumn("full_name")?.getFilterValue() as string) ?? "";

    const totalCount = data.length;
    const registeredCount = React.useMemo(() => data.filter(d => d.hasFaceBiometric).length, [data]);
    const pendingCount = totalCount - registeredCount;

    if (isLoading) {
        return (
            <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="h-10 w-[250px] bg-muted animate-pulse rounded-xl" />
                    <div className="h-10 w-[120px] bg-muted animate-pulse rounded-xl" />
                </div>
                <div className="rounded-2xl border h-[420px] bg-muted/5 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-5">
            {/* Top Bar: Segmented Status Tabs + Search & Filters */}
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                {/* Segmented Quick Status Pills */}
                <div className="flex items-center p-1 bg-muted/40 rounded-2xl border border-muted/30">
                    <button
                        type="button"
                        onClick={() => table.getColumn("status")?.setFilterValue("all")}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            currentStatusFilter === "all" || !currentStatusFilter
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Users className="h-3.5 w-3.5" />
                        <span>All Personnel</span>
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold">
                            {totalCount}
                        </Badge>
                    </button>

                    <button
                        type="button"
                        onClick={() => table.getColumn("status")?.setFilterValue("registered")}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            currentStatusFilter === "registered"
                                ? "bg-emerald-500/10 text-emerald-700 shadow-sm border border-emerald-500/20"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Enrolled</span>
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold text-emerald-700 bg-emerald-50">
                            {registeredCount}
                        </Badge>
                    </button>

                    <button
                        type="button"
                        onClick={() => table.getColumn("status")?.setFilterValue("pending")}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            currentStatusFilter === "pending"
                                ? "bg-amber-500/10 text-amber-700 shadow-sm border border-amber-500/20"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        <span>Pending</span>
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold text-amber-700 bg-amber-50">
                            {pendingCount}
                        </Badge>
                    </button>
                </div>

                {/* Search & Department Filters */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                    {/* Search Field with Clear Button */}
                    <div className="relative w-full sm:w-[280px] group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search employee name..."
                            value={currentSearch}
                            onChange={(event) =>
                                table.getColumn("full_name")?.setFilterValue(event.target.value)
                            }
                            className="pl-9 pr-8 h-10 bg-muted/30 border-muted rounded-xl text-xs focus:bg-background transition-all"
                        />
                        {currentSearch && (
                          <button
                            onClick={() => table.getColumn("full_name")?.setFilterValue("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                    </div>
                    
                    {/* Department Filter */}
                    <Select
                        value={(table.getColumn("department")?.getFilterValue() as string) ?? "all"}
                        onValueChange={(value) => 
                            table.getColumn("department")?.setFilterValue(value === "all" ? "" : value)
                        }
                    >
                        <SelectTrigger className="h-10 w-full sm:w-[200px] rounded-xl bg-muted/30 border-muted text-xs">
                            <SelectValue placeholder="All Departments" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-xl">
                            <SelectItem value="all" className="text-xs">All Departments</SelectItem>
                            {departments.map((dept) => (
                                <SelectItem key={dept.department_id} value={dept.department_id.toString()} className="text-xs">
                                    {dept.department_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table Viewport */}
            <div className="rounded-2xl border bg-background overflow-x-auto ring-1 ring-muted/10 shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/30">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="hover:bg-transparent border-b-muted/20">
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} className="h-11 px-6 text-xs font-semibold text-muted-foreground">
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
                                    className="hover:bg-primary/[0.03] transition-colors border-b-muted/10 group h-16"
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
                                    className="h-44 text-center"
                                >
                                    <div className="flex flex-col items-center justify-center gap-2 opacity-60">
                                        <ScanFace className="h-10 w-10 text-muted-foreground stroke-1" />
                                        <p className="text-sm font-medium text-muted-foreground">
                                          No personnel records found matching filters
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-2 gap-4 pt-1">
                <div className="text-xs text-muted-foreground font-medium order-2 sm:order-1">
                    Showing <span className="text-foreground font-bold">{table.getFilteredRowModel().rows.length}</span> of {totalCount} employees
                </div>
                <div className="flex items-center space-x-2.5 order-1 sm:order-2 bg-muted/20 p-1 rounded-xl border border-muted/10">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg hover:bg-background"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <div className="text-xs font-bold px-2.5 tabular-nums">
                        Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg hover:bg-background"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
