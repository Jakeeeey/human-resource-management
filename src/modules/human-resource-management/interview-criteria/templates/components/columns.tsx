"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, Star } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { Template } from "../types";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
    active: "default",
    draft: "secondary",
    archived: "outline",
};

export const createColumns = (
    onEdit: (template: Template) => void,
    onDelete: (template: Template) => void
): ColumnDef<Template>[] => [
    {
        accessorKey: "name",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
                Name
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
    },
    {
        accessorKey: "stage",
        header: "Stage",
        cell: ({ row }) => (
            <Badge variant="outline">{row.getValue("stage")}</Badge>
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string;
            return (
                <Badge variant={STATUS_VARIANTS[status] || "secondary"} className="capitalize">
                    {status}
                </Badge>
            );
        },
    },
    {
        id: "default",
        header: "Default",
        cell: ({ row }) =>
            row.original.is_default_for_stage ? (
                <Badge variant="default" className="gap-1">
                    <Star className="h-3 w-3" />
                    Default
                </Badge>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    },
    {
        id: "criteria_count",
        header: "# Criteria",
        cell: ({ row }) => <div>{row.original.criteria?.length ?? 0}</div>,
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const template = row.original;

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onEdit(template)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => onDelete(template)}
                            className="text-destructive focus:text-destructive"
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
