"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Eye } from "lucide-react";
import { APPLICANT_STATUS_LABELS, type ApplicantRow, type ApplicantStatus } from "../types";

export function getApplicantStatusColor(status: ApplicantStatus) {
    switch (status) {
        case "final_approved":
        case "hired":
            return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
        case "rejected":
            return "bg-red-500/10 text-red-600 border-red-500/20";
        case "withdrawn":
            return "bg-stone-500/10 text-stone-600 border-stone-500/20";
        case "recommended":
        case "verdict_pending":
        case "for_signing":
        case "incomplete":
            return "bg-amber-500/10 text-amber-600 border-amber-500/20";
        case "initial_interview":
        case "final_interview":
            return "bg-blue-500/10 text-blue-600 border-blue-500/20";
        case "draft":
        case "submitted":
        case "quiz_completed":
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
                const name = applicant.full_name || "—";
                return (
                    <div className="font-medium truncate max-w-[300px]" title={name}>
                        {name}
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
            cell: ({ row }) => {
                const position = row.original.position_applied_for || "—";
                return (
                    <div className="truncate max-w-[200px]" title={position}>
                        {position}
                    </div>
                );
            },
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                // `applicant.status` is the single truth — rendered verbatim,
                // never derived. Sorting/filtering operate on the raw value.
                const status = row.original.status;
                if (status === null) {
                    return <span className="text-muted-foreground">—</span>;
                }
                return (
                    <Badge
                        variant="outline"
                        className={`px-3 py-1.5 rounded-full font-bold uppercase tracking-wider ${getApplicantStatusColor(status)}`}
                    >
                        {APPLICANT_STATUS_LABELS[status]}
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
