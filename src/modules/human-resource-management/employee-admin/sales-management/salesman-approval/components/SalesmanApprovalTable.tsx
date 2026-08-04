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
import { CheckCircle2, MoreHorizontal, XCircle } from "lucide-react";
import type { SalesmanDraftWithRelations } from "../types";

interface SalesmanApprovalTableProps {
    drafts: SalesmanDraftWithRelations[];
    onApprove: (draft: SalesmanDraftWithRelations) => void;
    onReject: (draft: SalesmanDraftWithRelations) => void;
}

export function SalesmanApprovalTable({
    drafts,
    onApprove,
    onReject,
}: SalesmanApprovalTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });

    useEffect(() => {
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, [drafts]);

    const columns: ColumnDef<SalesmanDraftWithRelations>[] = [
        {
            accessorKey: "employee_id",
            header: "Employee Name",
            cell: ({ row }) => {
                const employee = row.original.employee;
                if (!employee) return <div>{row.getValue("employee_id")}</div>;
                const name = [employee.user_fname, employee.user_lname].filter(Boolean).join(" ");
                return <div>{name || employee.user_id}</div>;
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
                const draft = row.original;

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
                            <DropdownMenuItem onClick={() => onApprove(draft)} className="text-green-600">
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onReject(draft)} className="text-destructive">
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data: drafts,
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
                                {drafts.length === 0
                                    ? "No drafts pending approval."
                                    : "No results on this page."}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            {drafts.length > 0 ? (
                <div className="border-t py-2">
                    <DataTablePagination
                        pageIndex={table.getState().pagination.pageIndex + 1}
                        pageSize={table.getState().pagination.pageSize}
                        rowCount={drafts.length}
                        onPageChange={(page) => table.setPageIndex(page - 1)}
                        onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
                    />
                </div>
            ) : null}
        </div>
    );
}
