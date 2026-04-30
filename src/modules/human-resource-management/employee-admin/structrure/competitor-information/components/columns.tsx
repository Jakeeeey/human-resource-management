"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Competitor } from "../types";
import { formatCreatedBy, formatDateTime, toWebsiteHref } from "../utils/formatters";

export function createColumns(
    onEdit: (competitor: Competitor) => void
): ColumnDef<Competitor>[] {
    return [
        {
            id: "no",
            header: "No.",
            cell: ({ row }) => row.index + 1,
        },
        {
            accessorKey: "name",
            header: "Name",
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
            header: "Province",
            cell: ({ row }) => row.original.province || "N/A",
        },
        {
            accessorKey: "city",
            header: "City",
            cell: ({ row }) => row.original.city || "N/A",
        },
        {
            accessorKey: "barangay",
            header: "Barangay",
            cell: ({ row }) => row.original.barangay || "N/A",
        },
        {
            accessorKey: "created_by",
            header: "Created by",
            cell: ({ row }) => formatCreatedBy(row.original.created_by ?? null),
        },
        {
            accessorKey: "created_at",
            header: "Created at",
            cell: ({ row }) => formatDateTime(row.original.created_at ?? null),
        },
        {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(row.original)}
                    aria-label="Edit competitor"
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            ),
        },
    ];
}
