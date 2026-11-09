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
import type { Assessment } from "../types";
import { formatPHT } from "../../utils/time";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
    active: "default",
    draft: "secondary",
    archived: "outline",
};

export const createColumns = (
    onEdit: (assessment: Assessment) => void,
    onDelete: (assessment: Assessment) => void,
    onStartAssessment: (assessment: Assessment) => void
): ColumnDef<Assessment>[] => [
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
        cell: ({ row }) => {
            const assessment = row.original;
            return (
                <div className="max-w-[140px] sm:max-w-[280px]">
                    <div className="truncate font-medium" title={assessment.name}>
                        {assessment.name}
                    </div>
                    {assessment.is_applicant_quiz && (
                        <Badge variant="default" className="mt-1 gap-1 sm:hidden">
                            <UserCheck className="h-3 w-3" />
                            Applicant Assessment
                        </Badge>
                    )}
                </div>
            );
        },
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
        id: "applicant_assessment",
        header: "Applicant Assessment",
        meta: { headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" },
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
        meta: { headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" },
        cell: ({ row }) => {
            const q = row.original;
            return <div className="text-muted-foreground">{q.pass_threshold_value}%</div>;
        },
    },
    {
        id: "number_of_questions",
        header: "# Questions",
        meta: { headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" },
        cell: ({ row }) => <div>{row.original.number_of_questions}</div>,
    },
    {
        id: "time_limit",
        header: "Time Limit",
        meta: { headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" },
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
        meta: { headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" },
        cell: ({ row }) => <div>{formatPHT(row.getValue("created_at") as string, { includeTime: false })}</div>,
    },
    {
        id: "start",
        cell: ({ row }) => {
            const assessment = row.original;
            const canStart = assessment.status === "active";
            return (
                <Button
                    size="sm"
                    disabled={!canStart}
                    onClick={() => onStartAssessment(assessment)}
                    title={canStart ? undefined : "Set this assessment's status to Active to start it"}
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
            const assessment = row.original;

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            aria-label={`Open actions for ${assessment.name}`}
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onEdit(assessment)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => onDelete(assessment)}
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
