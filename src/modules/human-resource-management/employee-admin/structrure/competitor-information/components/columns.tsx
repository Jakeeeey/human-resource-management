"use client";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, ExternalLink, MoreHorizontal, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Competitor } from "../types";
import { formatDateTime, toWebsiteHref } from "../utils/formatters";

function renderSortIcon(direction: false | "asc" | "desc") {
    const iconClass = direction ? "opacity-100" : "opacity-70";
    return <ArrowUpDown className={`ml-2 h-3.5 w-3.5 ${iconClass}`} />;
}

function SortableHeader({
    column,
    label,
}: {
    column: Column<Competitor, unknown>;
    label: string;
}) {
    const direction = column.getIsSorted();
    return (
        <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 px-2"
            onClick={() => column.toggleSorting(direction === "asc")}
        >
            {label}
            {renderSortIcon(direction)}
        </Button>
    );
}

export function createColumns(
    onEdit: (competitor: Competitor) => void,
    onView: (competitor: Competitor) => void
): ColumnDef<Competitor>[] {
    return [
        {
            id: "no",
            accessorKey: "id",
            header: ({ column }) => <SortableHeader column={column} label="No." />,
            cell: ({ row }) => row.index + 1,
        },
        {
            accessorKey: "name",
            header: ({ column }) => <SortableHeader column={column} label="Name" />,
            cell: ({ row }) => {
                const name = row.original.name || "N/A";
                if (name.length <= 25) return name;
                return `${name.slice(0, 25)}...`;
            },
        },
        {
            accessorKey: "website",
            header: "Website",
            cell: ({ row }) => {
                const value = row.original.website || "";
                const href = toWebsiteHref(value);
                if (!href) return "N/A";

                return (
                    <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        title={href}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                        Visit
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                );
            },
        },
        {
            accessorKey: "province",
            header: ({ column }) => <SortableHeader column={column} label="Province" />,
            cell: ({ row }) => row.original.province || "N/A",
        },
        {
            accessorKey: "city",
            header: ({ column }) => <SortableHeader column={column} label="City" />,
            cell: ({ row }) => row.original.city || "N/A",
        },
        {
            accessorKey: "barangay",
            header: ({ column }) => <SortableHeader column={column} label="Barangay" />,
            cell: ({ row }) => row.original.barangay || "N/A",
        },
        {
            accessorKey: "created_at",
            header: ({ column }) => <SortableHeader column={column} label="Created at" />,
            cell: ({ row }) => formatDateTime(row.original.created_at ?? null),
        },
        {
            id: "actions",
            header: "Action",
            enableSorting: false,
            cell: ({ row }) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Open actions">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onView(row.original)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(row.original)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];
}
