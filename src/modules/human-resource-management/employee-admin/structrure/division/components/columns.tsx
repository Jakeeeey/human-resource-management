/**
 * Division Table Columns
 * All 8 columns: ID, Name, Code, Head, Departments, Description, Date, Actions
 */

"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DivisionWithRelations } from "../types";
import { getUserFullName, formatDepartmentList } from "../types";

export const createColumns = (
    onEdit: (division: DivisionWithRelations) => void,
    onDelete: (division: DivisionWithRelations) => void
): ColumnDef<DivisionWithRelations>[] => [
    {
        accessorKey: "division_id",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    ID
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            return <div className="font-mono">#{row.getValue("division_id")}</div>;
        },
    },
    {
        accessorKey: "division_name",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Division Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            return (
                <div className="font-medium">{row.getValue("division_name")}</div>
            );
        },
    },
    {
        accessorKey: "division_code",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Code
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const code = row.getValue("division_code") as string | null;
            return code ? (
                <Badge variant="outline" className="font-mono">
                    {code}
                </Badge>
            ) : (
                <span className="text-muted-foreground">-</span>
            );
        },
    },
    {
        accessorKey: "division_head_user",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Division Head
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const user = row.original.division_head_user;
            return <div>{getUserFullName(user)}</div>;
        },
        sortingFn: (rowA, rowB) => {
            const userA = rowA.original.division_head_user;
            const userB = rowB.original.division_head_user;

            const nameA = getUserFullName(userA).toLowerCase();
            const nameB = getUserFullName(userB).toLowerCase();

            return nameA.localeCompare(nameB);
        },
    },
    {
        accessorKey: "departments",
        header: "Departments",
        cell: ({ row }) => {
            const departments = row.original.departments;
            return (
                <div className="max-w-[250px] text-sm">
                    {formatDepartmentList(departments)}
                </div>
            );
        },
    },
    {
        accessorKey: "division_description",
        header: "Description",
        cell: ({ row }) => {
            const description = row.getValue("division_description") as string | null;
            const truncated = description
                ? description.length > 50
                    ? description.substring(0, 50) + "..."
                    : description
                : "No description";
            return (
                <div className="max-w-[200px] text-sm text-muted-foreground">
                    {truncated}
                </div>
            );
        },
    },
    {
        accessorKey: "date_added",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Date Added
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const dateString = row.getValue("date_added") as string;
            const date = new Date(dateString);
            return (
                <div className="text-sm">
                    {date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                    })}
                </div>
            );
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const division = row.original;

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
                        <DropdownMenuItem
                            onClick={() =>
                                navigator.clipboard.writeText(
                                    division.division_id.toString()
                                )
                            }
                        >
                            Copy division ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onEdit(division)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit division
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onDelete(division)}
                            className="text-red-600"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete division
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
