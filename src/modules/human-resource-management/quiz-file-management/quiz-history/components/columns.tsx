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
                <div>
                    <div className="font-medium">{a.applicant?.full_name || "—"}</div>
                    {a.applicant?.position_applied_for && (
                        <div className="text-xs text-muted-foreground">
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
        cell: ({ row }) => <div>{formatDateTime(row.getValue("completed_at"))}</div>,
    },
    {
        id: "actions",
        cell: ({ row }) => (
            <Button variant="ghost" size="sm" onClick={() => onViewDetails(row.original)}>
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                View Details
            </Button>
        ),
    },
];
