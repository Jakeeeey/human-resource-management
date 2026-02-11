"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { DepartmentWithRelations } from "../types";
import { formatDate, truncateText } from "../utils/departmentTransformers";

export const createColumns = (
    onEdit: (department: DepartmentWithRelations) => void,
    onDelete: (department: DepartmentWithRelations) => void
): ColumnDef<DepartmentWithRelations>[] => [
    {
        accessorKey: "department_name",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() =>
                    column.toggleSorting(column.getIsSorted() === "asc")
                }
            >
                Department Name
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => (
            <div className="font-medium">
                {row.getValue("department_name")}
            </div>
        ),
    },

    {
        accessorKey: "department_description",
        header: "Description",
        cell: ({ row }) => {
            const description =
                row.getValue("department_description") as string;
            return (
                <div className="max-w-[300px]">
                    {truncateText(description || "No description", 50)}
                </div>
            );
        },
    },

    // ✅ FIXED — uses string column now
    {
        id: "department_head",
        header: "Department Head",
        cell: ({ row }) => {
            const u = row.original.department_head_user;
            if (!u) return "—";

            return `${u.user_fname} ${u.user_lname}`;
        },
        sortingFn: (a, b) => {
            const A = a.original.department_head_user;
            const B = b.original.department_head_user;

            const nameA = A ? `${A.user_fname} ${A.user_lname}` : "";
            const nameB = B ? `${B.user_fname} ${B.user_lname}` : "";

            return nameA.localeCompare(nameB);
        },
    },

    {
        id: "positions",
        header: "Positions",
        cell: ({ row }) => {
            const positions = row.original.positions || [];
            if (!positions.length) return "—";

            return (
                <div className="flex flex-wrap gap-1">
                    {positions.map(p => (
                        <Badge key={p.id}>{p.position}</Badge>
                    ))}
                </div>
            );
        },
    },


    {
        accessorKey: "date_added",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() =>
                    column.toggleSorting(column.getIsSorted() === "asc")
                }
            >
                Date Added
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => (
            <div>{formatDate(row.getValue("date_added") as string)}</div>
        ),
    },




    {
        id: "actions",
        cell: ({ row }) => {
            const department = row.original;

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>

                        <DropdownMenuItem
                            onClick={() =>
                                navigator.clipboard.writeText(
                                    department.department_id.toString()
                                )
                            }
                        >
                            Copy department ID
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={() => onEdit(department)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            onClick={() => onDelete(department)}
                            className="text-red-600"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
