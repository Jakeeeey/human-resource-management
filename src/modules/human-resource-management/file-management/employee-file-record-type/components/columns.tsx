"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, MoreHorizontal, Pencil } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import type { EmployeeFileRecordType } from "../types";

function formatDate(value: string): string {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return value;
    }
}

export const createColumns = (
    onEdit: (record: EmployeeFileRecordType) => void
): ColumnDef<EmployeeFileRecordType>[] => [
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
            if (!desc) return <div className="text-muted-foreground text-center">—</div>;

            return (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="max-w-[400px] truncate text-muted-foreground cursor-help text-center">
                                {desc}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[400px] p-3 shadow-xl border-none bg-zinc-900 text-zinc-100 text-left">
                            <div className="flex flex-col gap-3 text-sm leading-relaxed">
                                {(() => {
                                    // Only split on hyphens that have a space after them or are at the start
                                    // This prevents breaking compound words like "record-keeping"
                                    const parts = desc.split(/(?:\s+-\s+|^-|^\s+-)/m);
                                    const intro = parts[0].trim();
                                    const items = parts.slice(1).map(p => p.trim()).filter(Boolean);
                                    
                                    return (
                                        <>
                                            {intro && <p className="font-medium opacity-90">{intro}</p>}
                                            {items.length > 0 && (
                                                <ul className="space-y-1.5 ml-1">
                                                    {items.map((item, i) => (
                                                        <li key={i} className="flex gap-2 items-start">
                                                            <span className="shrink-0 opacity-70">-</span>
                                                            <span className="opacity-80">{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        },
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
            <div>{formatDate(row.getValue("created_at") as string)}</div>
        ),
    },
    {
        id: "actions",
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
                        <DropdownMenuItem
                            onClick={() =>
                                navigator.clipboard.writeText(record.id.toString())
                            }
                        >
                            Copy ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onEdit(record)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
