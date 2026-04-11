"use client";

import { useEffect, useState } from "react";
import {
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type PaginationState,
    type SortingState,
    type ColumnDef,
    useReactTable,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Eye, MoreHorizontal, Pencil, Users } from "lucide-react";
import type { SalesmanWithRelations } from "../types";

interface SalesmanTableProps {
    salesmen: SalesmanWithRelations[];
    onViewDetails: (salesman: SalesmanWithRelations) => void;
    onEdit: (salesman: SalesmanWithRelations) => void;
    onManageCustomers: (salesman: SalesmanWithRelations) => void;
}

export function SalesmanTable({
    salesmen,
    onViewDetails,
    onEdit,
    onManageCustomers,
}: SalesmanTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });

    useEffect(() => {
        // When the dataset changes (filters/search/refetch), return to page 1.
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [salesmen]);

    const columns: ColumnDef<SalesmanWithRelations>[] = [
        {
            accessorKey: "employee_id",
            header: "Employee ID",
            cell: ({ row }) => {
                const employee = row.original.employee;
                return <div>{employee?.user_id || row.getValue("employee_id")}</div>;
            },
        },
        {
            accessorKey: "salesman_code",
            header: "Salesman Code",
            cell: ({ row }) => (
                <div className="font-medium">{row.getValue("salesman_code")}</div>
            ),
        },
        {
            accessorKey: "salesman_name",
            header: "Salesman Name",
            cell: ({ row }) => <div>{row.getValue("salesman_name")}</div>,
        },
        {
            accessorKey: "truck_plate",
            header: "Truck Plate",
            cell: ({ row }) => {
                const plate = row.getValue("truck_plate") as string | null;
                return <div>{plate || "-"}</div>;
            },
        },
        {
            accessorKey: "price_type",
            header: "Price Type",
            cell: ({ row }) => {
                const priceType = row.original.price_type;
                return priceType ? (
                    <Badge variant="secondary">{priceType}</Badge>
                ) : (
                    <span className="text-muted-foreground">-</span>
                );
            },
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => {
                const salesman = row.original;

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onViewDetails(salesman)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(salesman)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onManageCustomers(salesman)}>
                                <Users className="mr-2 h-4 w-4" />
                                Manage Customers
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    // TanStack Table returns functions that React Compiler can't safely memoize.
    // This is expected; suppress the lint warning at this call site.
    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data: salesmen,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        onPaginationChange: setPagination,
        state: {
            sorting,
            pagination,
        },
    });

    return (
        <div className="rounded-md border overflow-hidden">
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
                                {salesmen.length === 0
                                    ? "No salesmen found."
                                    : "No results on this page."}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            {salesmen.length > 0 ? (
                <div className="border-t py-2">
                    <DataTablePagination
                        pageIndex={table.getState().pagination.pageIndex + 1}
                        pageSize={table.getState().pagination.pageSize}
                        rowCount={salesmen.length}
                        onPageChange={(page) => table.setPageIndex(page - 1)}
                        onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
                    />
                </div>
            ) : null}
        </div>
    );
}
