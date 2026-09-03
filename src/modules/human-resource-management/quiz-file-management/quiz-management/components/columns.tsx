"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, Play, UserCheck } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { Quiz } from "../types";

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

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
    active: "default",
    draft: "secondary",
    archived: "outline",
};

export const createColumns = (
    onEdit: (quiz: Quiz) => void,
    onDelete: (quiz: Quiz) => void,
    onStartQuiz: (quiz: Quiz) => void
): ColumnDef<Quiz>[] => [
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
        id: "applicant_quiz",
        header: "Applicant Quiz",
        cell: ({ row }) =>
            row.original.is_applicant_quiz ? (
                <Badge variant="default" className="gap-1">
                    <UserCheck className="h-3 w-3" />
                    Active
                </Badge>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    },
    {
        id: "pass_threshold",
        header: "Pass Threshold",
        cell: ({ row }) => {
            const q = row.original;
            return <div className="text-muted-foreground">{q.pass_threshold_value}%</div>;
        },
    },
    {
        id: "number_of_questions",
        header: "# Questions",
        cell: ({ row }) => <div>{row.original.number_of_questions}</div>,
    },
    {
        id: "time_limit",
        header: "Time Limit",
        cell: ({ row }) => {
            const q = row.original;
            return (
                <div className="text-muted-foreground">
                    {q.time_limit_enabled ? `${q.time_limit_minutes} min` : "—"}
                </div>
            );
        },
    },
    {
        accessorKey: "created_at",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
                Created At
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => <div>{formatDate(row.getValue("created_at") as string)}</div>,
    },
    {
        id: "start",
        cell: ({ row }) => {
            const quiz = row.original;
            const canStart = quiz.status === "active";
            return (
                <Button
                    size="sm"
                    disabled={!canStart}
                    onClick={() => onStartQuiz(quiz)}
                    title={canStart ? undefined : "Set this quiz's status to Active to start it"}
                >
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Start
                </Button>
            );
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const quiz = row.original;

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onEdit(quiz)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => onDelete(quiz)}
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
