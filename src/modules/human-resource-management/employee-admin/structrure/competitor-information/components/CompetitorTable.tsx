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
import { Card, CardContent } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Plus,
    Search,
    X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import type { Competitor, CompetitorFormData } from "../types";
import { createColumns } from "./columns";
import { CompetitorDialog } from "./CompetitorDialog";

interface CompetitorTableProps {
    data: Competitor[];
    isLoading?: boolean;
    onCreateCompetitor: (data: CompetitorFormData) => Promise<void>;
    onUpdateCompetitor: (id: number, data: CompetitorFormData) => Promise<void>;
}

function normalizeOption(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function buildOptions(values: Array<string | null | undefined>, allLabel: string) {
    const unique = new Set<string>();
    values.forEach((value) => {
        const normalized = normalizeOption(value);
        if (normalized) unique.add(normalized);
    });
    return [
        { value: "", label: allLabel },
        ...Array.from(unique)
            .sort((a, b) => a.localeCompare(b))
            .map((val) => ({ value: val, label: val })),
    ];
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

    const [search, setSearch] = React.useState("");
    const [nameFilter, setNameFilter] = React.useState("");
    const [provinceFilter, setProvinceFilter] = React.useState("");
    const [cityFilter, setCityFilter] = React.useState("");
    const [barangayFilter, setBarangayFilter] = React.useState("");

    const handleEdit = React.useCallback((competitor: Competitor) => {
        setSelectedCompetitor(competitor);
        setEditDialogOpen(true);
    }, []);

    const columns = React.useMemo(() => createColumns(handleEdit), [handleEdit]);

    const nameOptions = React.useMemo(
        () => buildOptions(data.map((item) => item.name), "All Names"),
        [data]
    );

    const provinceOptions = React.useMemo(
        () => buildOptions(data.map((item) => item.province), "All Provinces"),
        [data]
    );

    const cityOptions = React.useMemo(() => {
        const base = provinceFilter
            ? data.filter((item) => item.province === provinceFilter)
            : data;
        return buildOptions(base.map((item) => item.city), "All Cities");
    }, [data, provinceFilter]);

    const barangayOptions = React.useMemo(() => {
        const base = data.filter(
            (item) =>
                (!provinceFilter || item.province === provinceFilter) &&
                (!cityFilter || item.city === cityFilter)
        );
        return buildOptions(base.map((item) => item.barangay), "All Barangays");
    }, [data, provinceFilter, cityFilter]);

    const filteredData = React.useMemo(() => {
        let result = data;

        if (search) {
            const s = search.toLowerCase();
            result = result.filter((item) =>
                [item.name, item.website, item.province, item.city, item.barangay]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(s))
            );
        }

        if (nameFilter) result = result.filter((item) => item.name === nameFilter);
        if (provinceFilter) result = result.filter((item) => item.province === provinceFilter);
        if (cityFilter) result = result.filter((item) => item.city === cityFilter);
        if (barangayFilter) result = result.filter((item) => item.barangay === barangayFilter);

        return result;
    }, [data, search, nameFilter, provinceFilter, cityFilter, barangayFilter]);

    const hasActiveFilters =
        search || nameFilter || provinceFilter || cityFilter || barangayFilter;

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data: filteredData,
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
            <div className="flex items-center justify-end">
                <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Competitor
                </Button>
            </div>

            <Card className="border shadow-sm">
                <CardContent className="pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex-1 min-w-50">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search competitors..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        <SearchableSelect
                            options={nameOptions}
                            value={nameFilter}
                            onValueChange={(val) => setNameFilter(val)}
                            placeholder="Filter by name"
                            className="h-10 w-56 justify-between"
                        />

                        <SearchableSelect
                            options={provinceOptions}
                            value={provinceFilter}
                            onValueChange={(val) => {
                                setProvinceFilter(val);
                                setCityFilter("");
                                setBarangayFilter("");
                            }}
                            placeholder="Filter by province"
                            className="h-10 w-56 justify-between"
                        />

                        <SearchableSelect
                            options={cityOptions}
                            value={cityFilter}
                            onValueChange={(val) => {
                                setCityFilter(val);
                                setBarangayFilter("");
                            }}
                            placeholder="Filter by city"
                            className="h-10 w-56 justify-between"
                        />

                        <SearchableSelect
                            options={barangayOptions}
                            value={barangayFilter}
                            onValueChange={(val) => setBarangayFilter(val)}
                            placeholder="Filter by barangay"
                            className="h-10 w-56 justify-between"
                        />

                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setSearch("");
                                    setNameFilter("");
                                    setProvinceFilter("");
                                    setCityFilter("");
                                    setBarangayFilter("");
                                }}
                                className="h-10 px-3"
                            >
                                Reset
                                <X className="ml-2 h-4 w-4" />
                            </Button>
                        )}

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
                                            onCheckedChange={(value) =>
                                                column.toggleVisibility(!!value)
                                            }
                                        >
                                            {column.id}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardContent>
            </Card>

            <div className="rounded-md border shadow-sm">
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

            <div className="flex items-center justify-between px-2">
                <div className="flex-1 text-sm text-muted-foreground font-medium">
                    Showing {table.getRowModel().rows.length} of{" "}
                    {table.getFilteredRowModel().rows.length} record(s)
                </div>
                <div className="flex items-center space-x-6 lg:space-x-8">
                    <div className="flex items-center space-x-2">
                        <p className="text-sm font-bold">Rows per page</p>
                        <Select
                            value={`${table.getState().pagination.pageSize}`}
                            onValueChange={(value) => {
                                table.setPageSize(Number(value));
                            }}
                        >
                            <SelectTrigger className="h-8 w-17.5 rounded-lg">
                                <SelectValue
                                    placeholder={table.getState().pagination.pageSize}
                                />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[10, 20, 30, 40, 50].map((pageSize) => (
                                    <SelectItem key={pageSize} value={`${pageSize}`}>
                                        {pageSize}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex w-25 items-center justify-center text-sm font-bold">
                        Page {table.getState().pagination.pageIndex + 1} of{" "}
                        {table.getPageCount()}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex rounded-lg"
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <span className="sr-only">Go to first page</span>
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0 rounded-lg"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <span className="sr-only">Go to previous page</span>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0 rounded-lg"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            <span className="sr-only">Go to next page</span>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex rounded-lg"
                            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                            disabled={!table.getCanNextPage()}
                        >
                            <span className="sr-only">Go to last page</span>
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
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
