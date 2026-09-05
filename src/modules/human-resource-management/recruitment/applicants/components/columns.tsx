"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Eye } from "lucide-react";
import type { ApplicantRow } from "../types";

export function getApplicantStageColor(stage: string) {
    switch (stage) {
        case "Final Passed":
        case "Approved":
        case "Hired":
        case "Passed":
            return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
        case "Final Failed":
        case "Rejected":
        case "Failed":
            return "bg-red-500/10 text-red-600 border-red-500/20";
        case "Recommended":
        case "Final Pending":
        case "Pending":
            return "bg-amber-500/10 text-amber-600 border-amber-500/20";
        case "Initial Pending":
        case "Initial Passed":
        case "Initial Failed":
            return "bg-blue-500/10 text-blue-600 border-blue-500/20";
        case "Withdrawn":
            return "bg-stone-500/10 text-stone-600 border-stone-500/20";
        default:
            return "bg-primary/10 text-primary border-primary/20";
    }
}

export function createColumns(
    onSelect: (row: ApplicantRow) => void
): ColumnDef<ApplicantRow>[] {
    return [
        {
            accessorKey: "full_name",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Applicant
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const applicant = row.original;
                return (
                    <div className="font-medium truncate max-w-[300px]">
                        {applicant.full_name || "—"}
                    </div>
                );
            },
        },
        {
            accessorKey: "position_applied_for",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Position
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="truncate max-w-[200px]">
                    {row.original.position_applied_for || "—"}
                </div>
            ),
        },
        {
            accessorKey: "stage",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Stage
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                // Server-computed stage rendered verbatim — never re-derived here.
                const stage = row.getValue("stage") as ApplicantRow["stage"];
                return (
                    <Badge
                        variant="outline"
                        className={`px-3 py-1.5 rounded-full font-bold uppercase tracking-wider ${getApplicantStageColor(stage)}`}
                    >
                        {stage}
                    </Badge>
                );
            },
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => onSelect(row.original)}>
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        View
                    </Button>
                </div>
            ),
        },
    ];
}
