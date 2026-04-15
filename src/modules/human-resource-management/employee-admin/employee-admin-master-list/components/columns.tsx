/**
 * Employee Table Columns
 * Aligned with Spring Boot /users API schema
 */

"use client";

import { ColumnDef } from "@tanstack/react-table";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User, Department } from "../types";

const PROXY_BASE = "/api/hrm/employee-admin/employee-master-list";

function isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/** Resolve image paths: Redirects UUIDs to Directus Proxy, handles full URLs */
function resolveImageUrl(path?: string | null): string {
    if (!path) return "";
    if (path.startsWith("http") || path.startsWith("blob:")) return path;
    if (isUUID(path)) {
        return `${PROXY_BASE}/assets/${path}`;
    }
    // Fallback for Spring Boot paths like /uploads/users/...
    // If NEXT_PUBLIC_API_BASE_URL is Directus, we need to be careful.
    // However, if the path starts with /, it might be intended for the public folder or absolute.
    const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";
    return `${base}${path}`;
}

export const createColumns = (
    onViewDetails: (employee: User) => void,
    onDelete: (employee: User) => void,
    departments: Department[] = []
): ColumnDef<User>[] => [
    {
        accessorKey: "id",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="-ml-4 font-bold text-foreground"
            >
                ID
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => (
            <div className="font-mono font-medium text-muted-foreground">#{row.getValue("id")}</div>
        ),
    },
    {
        id: "full_name",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="-ml-4 font-bold text-foreground"
            >
                Employee
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => {
            const user = row.original;
            const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`;
            const imageUrl = resolveImageUrl(user.image);

            return (
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                        <AvatarImage src={imageUrl} alt={user.firstName} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-semibold text-foreground">
                            {user.firstName} {user.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                </div>
            );
        },
        sortingFn: (rowA, rowB) => {
            const nameA = `${rowA.original.firstName} ${rowA.original.lastName}`.toLowerCase();
            const nameB = `${rowB.original.firstName} ${rowB.original.lastName}`.toLowerCase();
            return nameA.localeCompare(nameB);
        },
        filterFn: (row, id, filterValue) => {
            const name = `${row.original.firstName} ${row.original.lastName}`.toLowerCase();
            return name.includes((filterValue as string).toLowerCase());
        },
    },
    {
        accessorKey: "position",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="-ml-4 font-bold text-foreground"
            >
                Position
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <div className="font-medium">{row.getValue("position") || "N/A"}</div>,
    },
    {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) => {
            const deptId = row.original.department;
            const dept = departments.find(d => d.department_id === deptId);
            return (
                <div className="text-sm font-medium">{dept?.department_name || "Unassigned"}</div>
            );
        },
        filterFn: (row, _id, value) => {
            if (!value || value === "all") return true;
            return row.original.department?.toString() === value.toString();
        },
    },
    {
        accessorKey: "dateOfHire",
        header: "Date Hired",
        cell: ({ row }) => {
            const dateStr = row.getValue("dateOfHire") as string;
            if (!dateStr) return <span className="text-muted-foreground">N/A</span>;
            const date = new Date(dateStr);
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
            const user = row.original;

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted/50">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px]">
                        <DropdownMenuLabel>Employee Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => navigator.clipboard.writeText(user.id.toString())}
                        >
                            Copy ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onViewDetails(user)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onDelete(user)}
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Archive Record
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
