"use client";

import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { SquarePen, MoreHorizontal, Eye } from "lucide-react";
import type { OperationWithRelations } from "../types";

export const createColumns = (
    onEdit: (operation: OperationWithRelations) => void,
    onView: (operation: OperationWithRelations) => void
): ColumnDef<OperationWithRelations>[] => [
    {
        accessorKey: "operation_code",
        header: "Code",
        meta: { label: "Operation Code" },
    },
    {
        id: "name_or_code",
        accessorFn: (row) => row.operation_name,
        header: "Name",
        meta: { label: "Operation Name" },
        filterFn: (row, id, value) => {
            const s = value.toLowerCase();
            return (
                (row.original.operation_name?.toLowerCase().includes(s) || false) ||
                (row.original.operation_code?.toLowerCase().includes(s) || false)
            );
        }
    },
    {
        accessorKey: "type",
        header: "Type",
        meta: { label: "Type" },
        cell: ({ row }) => {
            const val = row.original.type;
            return val ? val : <span className="text-muted-foreground opacity-50">—</span>;
        }
    },
    {
        accessorKey: "definition",
        header: "Definition",
        meta: { label: "Definition" },
        cell: ({ row }) => {
            const def = row.original.definition;
            if (!def) return <span className="text-muted-foreground opacity-50">—</span>;
            return (
                <div className="max-w-[200px] truncate text-xs" title={def}>
                    {def}
                </div>
            );
        }
    },
    {
        id: "actions",
        header: "Action",
        enableHiding: false,
        cell: ({ row }) => {
            const operation = row.original;

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px]">
                        <DropdownMenuItem onClick={() => onView(operation)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(operation)}>
                            <SquarePen className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
