"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EmploymentStatus } from "../types";

function pickString(obj: Record<string, unknown>, keys: string[]): string {
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
}

function formatUser(value: unknown): string {
    if (!value) return "-";

    if (typeof value === "string" || typeof value === "number") {
        return String(value);
    }

    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const directName = pickString(obj, [
            "name",
            "full_name",
            "display_name",
            "user_name",
            "username",
        ]);
        if (directName) return directName;

        const first = pickString(obj, [
            "Firstname",
            "FirstName",
            "firstName",
            "firstname",
            "first_name",
            "user_fname",
            "user_firstname",
            "user_first_name",
            "user_first",
        ]);
        const last = pickString(obj, [
            "LastName",
            "Lastname",
            "lastName",
            "lastname",
            "last_name",
            "user_lname",
            "user_lastname",
            "user_last_name",
            "user_last",
        ]);
        const email = pickString(obj, ["email", "Email", "user_email"]);
        const name = [first, last].filter(Boolean).join(" ");
        if (name) return name;
        if (email) return email;
        if (typeof obj.user_id === "string" || typeof obj.user_id === "number") {
            return String(obj.user_id);
        }
        if (typeof obj.id === "string" || typeof obj.id === "number") {
            return String(obj.id);
        }
    }

    return "-";
}

function formatDateTime(value: string): string {
    if (!value) return "-";
    try {
        return new Date(value).toLocaleString("en-US", {
            timeZone: "UTC",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return value;
    }
}

export const createColumns = (
    onView: (record: EmploymentStatus) => void,
    onEdit: (record: EmploymentStatus) => void,
    onDelete: (record: EmploymentStatus) => void
): ColumnDef<EmploymentStatus>[] => [
    {
        id: "no",
        header: "No.",
        cell: ({ row }) => <div>{row.index + 1}</div>,
    },
    {
        accessorKey: "name",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() =>
                    column.toggleSorting(column.getIsSorted() === "asc")
                }
            >
                Name
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => (
            <div className="font-medium">{row.getValue("name")}</div>
        ),
    },
    {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
            const desc = row.getValue("description") as string | null;
            if (!desc) return <div className="text-muted-foreground text-center">-</div>;

            return (
                <div className="max-w-90 truncate text-muted-foreground">
                    {desc}
                </div>
            );
        },
    },
    {
        accessorKey: "created_by",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() =>
                    column.toggleSorting(column.getIsSorted() === "asc")
                }
            >
                Created By
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <div>{formatUser(row.getValue("created_by"))}</div>,
        sortingFn: (rowA, rowB, columnId) =>
            formatUser(rowA.getValue(columnId)).localeCompare(
                formatUser(rowB.getValue(columnId))
            ),
    },
    {
        accessorKey: "created_at",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() =>
                    column.toggleSorting(column.getIsSorted() === "asc")
                }
            >
                Created At
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => (
            <div>{formatDateTime(row.getValue("created_at") as string)}</div>
        ),
    },
    {
        accessorKey: "updated_by",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() =>
                    column.toggleSorting(column.getIsSorted() === "asc")
                }
            >
                Updated By
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <div>{formatUser(row.getValue("updated_by"))}</div>,
        sortingFn: (rowA, rowB, columnId) =>
            formatUser(rowA.getValue(columnId)).localeCompare(
                formatUser(rowB.getValue(columnId))
            ),
    },
    {
        accessorKey: "updated_at",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() =>
                    column.toggleSorting(column.getIsSorted() === "asc")
                }
            >
                Updated At
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => (
            <div>{formatDateTime(row.getValue("updated_at") as string)}</div>
        ),
    },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
            const record = row.original;

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onView(record)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(record)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {/* <DropdownMenuItem
                            onClick={() => onDelete(record)}
                            className="text-red-600 focus:text-red-600"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem> */}
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
