"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Layers } from "lucide-react";
import { SubsystemRegistration } from "../types";

export const createColumns = (
    onEdit: (subsystem: SubsystemRegistration) => void,
    onDelete: (subsystem: SubsystemRegistration) => void,
    onManageHierarchy: (subsystem: SubsystemRegistration) => void
): ColumnDef<SubsystemRegistration>[] => [
    {
        accessorKey: "slug",
        header: "Slug",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.slug}</span>,
    },
    {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
            <div className="flex flex-col">
                <span className="font-medium">{row.original.title}</span>
                <span className="text-xs text-muted-foreground">{row.original.subtitle}</span>
            </div>
        ),
    },
    {
        accessorKey: "base_path",
        header: "Base Path",
        cell: ({ row }) => <span className="text-xs">{row.original.base_path}</span>,
    },
    {
        accessorKey: "category",
        header: "Category",
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.original.status;
            return (
                <Badge variant={status === "active" ? "default" : "secondary"}>
                    {status}
                </Badge>
            );
        },
    },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" title="Manage Hierarchy" onClick={() => onManageHierarchy(row.original)}>
                    <Layers className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Edit Subsystem" onClick={() => onEdit(row.original)}>
                    <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Delete Subsystem" onClick={() => onDelete(row.original)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        ),
    },
];
