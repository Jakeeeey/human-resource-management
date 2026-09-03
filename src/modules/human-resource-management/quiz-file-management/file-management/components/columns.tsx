"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, RotateCcw } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { QuizQuestionWithOptions } from "../types";

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

const TYPE_LABELS: Record<string, string> = {
    true_false: "True / False",
    multiple_choice: "Multiple Choice",
    identification: "Identification",
    fill_in_the_blank: "Fill in the Blank",
};

export const createColumns = (
    onEdit: (question: QuizQuestionWithOptions) => void,
    onDelete: (question: QuizQuestionWithOptions) => void,
    onReactivate: (question: QuizQuestionWithOptions) => void
): ColumnDef<QuizQuestionWithOptions>[] => [
    {
        accessorKey: "question_text",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() =>
                    column.toggleSorting(column.getIsSorted() === "asc")
                }
            >
                Question
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => (
            <div className="max-w-[400px] truncate font-medium">
                {row.getValue("question_text")}
            </div>
        ),
    },
    {
        accessorKey: "question_type",
        header: "Type",
        cell: ({ row }) => {
            const type = row.getValue("question_type") as string;
            return <Badge variant="secondary">{TYPE_LABELS[type] || type}</Badge>;
        },
    },
    {
        id: "options",
        header: "Options",
        cell: ({ row }) => {
            const count = row.original.options?.length ?? 0;
            return <div className="text-muted-foreground">{count}</div>;
        },
    },
    {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => {
            const category = row.getValue("category") as string | null;
            return category ? (
                <Badge variant="outline">{category}</Badge>
            ) : (
                <span className="text-muted-foreground">—</span>
            );
        },
    },
    {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => {
            const isActive = row.getValue("is_active") as boolean;
            return (
                <Badge variant={isActive ? "secondary" : "destructive"}>
                    {isActive ? "Active" : "Inactive"}
                </Badge>
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
            const question = row.original;

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onEdit(question)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {question.is_active ? (
                            <DropdownMenuItem
                                onClick={() => onDelete(question)}
                                className="text-destructive focus:text-destructive"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Deactivate
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem onClick={() => onReactivate(question)}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reactivate
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
