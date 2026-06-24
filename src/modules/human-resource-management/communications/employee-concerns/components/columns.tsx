"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Eye, Trash2, MessageSquareWarning, UserCircle2, CalendarClock, EyeOff } from "lucide-react";
import { cn, formatDateTime, isValidDate } from "@/lib/utils";
import {
    EnrichedEmployeeConcern,
    ConcernStatus,
    CONCERN_STATUS_LABELS,
} from "../types/employee-concern.schema";

/** Tailwind class map per status — mirrors the subsystem-registration cn() pattern. */
const STATUS_STYLES: Record<ConcernStatus, string> = {
    PENDING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    IN_REVIEW: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    RESOLVED: "bg-green-500/10 text-green-600 border-green-500/20",
    DISMISSED: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

const STATUS_DOT: Record<ConcernStatus, string> = {
    PENDING: "bg-amber-600",
    IN_REVIEW: "bg-blue-600",
    RESOLVED: "bg-green-600",
    DISMISSED: "bg-zinc-600",
};

/** Reusable status pill used by the table and the detail dialog. */
export function StatusBadge({ status }: { status: ConcernStatus }) {
    return (
        <div
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                STATUS_STYLES[status]
            )}
        >
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
            {CONCERN_STATUS_LABELS[status]}
        </div>
    );
}

export const createColumns = (
    onView: (concern: EnrichedEmployeeConcern) => void,
    onDelete: (concern: EnrichedEmployeeConcern) => void
): ColumnDef<EnrichedEmployeeConcern>[] => [
    {
        accessorKey: "subject_of_concern",
        header: "Subject",
        cell: ({ row }) => (
            <div className="flex items-center gap-3 py-1">
                <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                    <MessageSquareWarning className="h-4 w-4 text-primary" />
                </div>
                <span className="font-semibold text-sm tracking-tight text-foreground line-clamp-1 max-w-[320px]">
                    {row.original.subject_of_concern}
                </span>
            </div>
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        filterFn: (row, columnId, filterValue) => {
            if (filterValue === "ALL") return true;
            return row.getValue(columnId) === filterValue;
        },
    },
    {
        id: "anonymous",
        header: "Anonymity",
        cell: ({ row }) =>
            row.original.is_anonymous ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <EyeOff className="h-3.5 w-3.5" />
                    Anonymous
                </span>
            ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70">
                    <UserCircle2 className="h-3.5 w-3.5" />
                    Identified
                </span>
            ),
    },
    {
        id: "submitted_by",
        header: "Submitted By",
        cell: ({ row }) => {
            const c = row.original;
            const name = c.is_anonymous ? "Anonymous" : c.user_name || c.created_by_name || "—";
            return (
                <div className="flex flex-col">
                    <span className="text-sm font-medium">{name}</span>
                    {c.user_email && !c.is_anonymous && (
                        <span className="text-[10px] text-muted-foreground/70">{c.user_email}</span>
                    )}
                </div>
            );
        },
    },
    {
        accessorKey: "created_at",
        header: "Submitted On",
        cell: ({ row }) => {
            const raw = row.original.created_at;
            if (!raw) return <span className="text-sm text-muted-foreground">—</span>;
            const d = new Date(raw);
            return (
                <div className="flex items-center gap-2">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span className="text-sm text-muted-foreground">
                        {formatDateTime(isValidDate(d) ? d : new Date())}
                    </span>
                </div>
            );
        },
    },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    title="View concern"
                    onClick={() => onView(row.original)}
                    className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-muted active:scale-90 transition-all"
                >
                    <Eye className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    title="Delete concern"
                    onClick={() => onDelete(row.original)}
                    className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10 active:scale-90 transition-all"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        ),
    },
];
