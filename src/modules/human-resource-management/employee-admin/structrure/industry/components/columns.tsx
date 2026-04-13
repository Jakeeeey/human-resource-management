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
import type { IndustryWithRelations } from "../types";

export const createColumns = (
    onEdit: (industry: IndustryWithRelations) => void,
    onView: (industry: IndustryWithRelations) => void
): ColumnDef<IndustryWithRelations>[] => [
    {
        accessorKey: "industry_code",
        header: "Industry Code",
        meta: { label: "Industry Code" },
    },
    {
        id: "name_code_or_head",
        accessorFn: (row) => row.industry_name,
        header: "Industry Name",
        meta: { label: "Industry Name" },
        filterFn: (row, id, value) => {
            const s = value.toLowerCase();
            return (
                (row.original.industry_name?.toLowerCase().includes(s) || false) ||
                (row.original.industry_code?.toLowerCase().includes(s) || false) ||
                (row.original.industry_head?.toLowerCase().includes(s) || false)
            );
        }
    },
    {
        accessorKey: "industry_head",
        header: "Industry Head",
        meta: { label: "Industry Head" },
        cell: ({ row }) => {
            const val = row.original.industry_head;
            return val ? val : <span className="text-muted-foreground opacity-50">—</span>;
        }
    },
    {
        accessorKey: "tax_id",
        header: "Tax ID",
        meta: { label: "Tax ID" },
        cell: ({ row }) => {
            const val = row.original.tax_id;
            return val ? val : <span className="text-muted-foreground opacity-50">—</span>;
        }
    },
    {
        accessorKey: "industry_description",
        header: "Description",
        meta: { label: "Description" },
        cell: ({ row }) => {
            const desc = row.original.industry_description;
            if (!desc) return <span className="text-muted-foreground italic text-xs">No description</span>;
            return (
                <div className="max-w-[180px] truncate text-xs" title={desc}>
                    {desc}
                </div>
            );
        }
    },
    {
        id: "actions",
        header: "Action",
        enableHiding: false,
        cell: ({ row }) => {
            const industry = row.original;

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px]">
                        <DropdownMenuItem onClick={() => onView(industry)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(industry)}>
                            <SquarePen className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
