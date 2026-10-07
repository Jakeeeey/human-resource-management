"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { QuizAttempt } from "../types";

function formatPercentage(value: number | string): string {
    return `${parseFloat(String(value))}%`;
}

function formatDateTime(value: string | null): string {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    } catch {
        return value;
    }
}

export const createColumns = (
    onViewDetails: (attempt: QuizAttempt) => void
): ColumnDef<QuizAttempt>[] => [
    {
        id: "applicant",
        header: "Applicant",
        cell: ({ row }) => {
            const a = row.original;
            return (
                <div className="min-w-0">
                    <div
                        className="max-w-[120px] truncate font-medium sm:max-w-[300px]"
                        title={a.applicant?.full_name || undefined}
                    >
                        {a.applicant?.full_name || "—"}
                    </div>
                    {a.applicant?.position_applied_for && (
                        <div className="max-w-[120px] truncate text-xs text-muted-foreground sm:max-w-[200px]">
                            {a.applicant.position_applied_for}
                        </div>
                    )}
                </div>
            );
        },
    },
    {
        id: "quiz",
        header: "Quiz",
        meta: { headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" },
        cell: ({ row }) => <div>{row.original.quiz?.name || "—"}</div>,
    },
    {
        id: "score",
        header: "Score",
        cell: ({ row }) => {
            const a = row.original;
            return (
                <div className="text-muted-foreground">
                    {a.score} / {a.number_of_questions_snapshot} ({formatPercentage(a.percentage_score)})
                </div>
            );
        },
    },
    {
        accessorKey: "passed",
        header: "Result",
        cell: ({ row }) => {
            const passed = row.getValue("passed") as boolean;
            return (
                <Badge variant={passed ? "secondary" : "destructive"}>
                    {passed ? "Passed" : "Failed"}
                </Badge>
            );
        },
    },
    {
        accessorKey: "completed_at",
        header: ({ column }) => (
            <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
                Completed
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        meta: { headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" },
        cell: ({ row }) => <div>{formatDateTime(row.getValue("completed_at"))}</div>,
    },
    {
        id: "actions",
        cell: ({ row }) => (
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewDetails(row.original)}
                aria-label="View answer breakdown"
                title="View details"
            >
                <Eye className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">View Details</span>
            </Button>
        ),
    },
];
