"use client";

import type { JSX } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ClearanceFormOverview } from "../types";
import type { ClearanceFormStatusFilter } from "../hooks/useClearanceForms";

interface ClearanceFormListProps {
    rows: ClearanceFormOverview[];
    total: number;
    page: number;
    totalPages: number;
    status: ClearanceFormStatusFilter;
    selectedRequestId: number | null;
    isLoading?: boolean;
    error?: string | null;
    onSelect: (row: ClearanceFormOverview) => void;
    onPageChange: (page: number) => void;
    onRetry: () => void;
}

function statusTone(status: ClearanceFormOverview["status"]): StatusTone {
    if (status === "issued") return "success";
    if (status === "draft") return "info";
    return "neutral";
}

function statusLabel(status: ClearanceFormOverview["status"]): string {
    if (status === "issued") return "Issued";
    if (status === "draft") return "Draft";
    return "Missing";
}

export function ClearanceFormList({
    rows,
    total,
    page,
    totalPages,
    status,
    selectedRequestId,
    isLoading = false,
    error = null,
    onSelect,
    onPageChange,
    onRetry,
}: ClearanceFormListProps): JSX.Element {
    if (isLoading) {
        return (
            <div className="space-y-2">
                {[...Array(5)].map((_, index) => (
                    <Skeleton key={index} className="h-13 w-full" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button onClick={onRetry} variant="outline">
                    Retry
                </Button>
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <p className="font-medium">No clearance forms found.</p>
                <p className="text-sm text-muted-foreground">
                    {status === "all"
                        ? "Nothing has been filed yet."
                        : "No forms match the current status filter."}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="max-h-120 overflow-auto rounded-md border">
                <table className="w-full min-w-200 table-fixed caption-bottom text-sm">
                    <colgroup>
                        <col className="w-24" />
                        <col />
                        <col />
                        <col className="w-28" />
                        <col />
                        <col className="w-28" />
                    </colgroup>
                    <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                        <TableRow>
                            <TableHead className="h-12 bg-card px-4">Request</TableHead>
                            <TableHead className="h-12 bg-card px-4">Employee</TableHead>
                            <TableHead className="h-12 bg-card px-4">Template</TableHead>
                            <TableHead className="h-12 bg-card px-4">Status</TableHead>
                            <TableHead className="h-12 bg-card px-4">Ref No.</TableHead>
                            <TableHead className="h-12 bg-card px-4">Company</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => {
                            const isActive = selectedRequestId === row.request_id;
                            return (
                                <TableRow
                                    key={row.request_id}
                                    aria-selected={isActive}
                                    tabIndex={0}
                                    onClick={() => onSelect(row)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            onSelect(row);
                                        }
                                    }}
                                    className={cn(
                                        "cursor-pointer hover:bg-muted/50",
                                        isActive && "border-primary/30 bg-primary/5 hover:bg-primary/10"
                                    )}
                                >
                                    <TableCell className="px-4 py-4 font-medium tabular-nums">
                                        #{row.request_id}
                                    </TableCell>
                                    <TableCell className="truncate px-4 py-4" title={row.employee_name}>
                                        {row.employee_name}
                                    </TableCell>
                                    <TableCell className="truncate px-4 py-4" title={row.template_title ?? ""}>
                                        {row.template_title ?? "—"}
                                    </TableCell>
                                    <TableCell className="px-4 py-4">
                                        <StatusBadge tone={statusTone(row.status)}>
                                            {statusLabel(row.status)}
                                        </StatusBadge>
                                    </TableCell>
                                    <TableCell className="truncate px-4 py-4" title={row.ref_no ?? ""}>
                                        {row.ref_no ?? "—"}
                                    </TableCell>
                                    <TableCell className="truncate px-4 py-4" title={row.company_code ?? ""}>
                                        {row.company_code ?? "—"}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </table>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                    Page {page} of {totalPages} · {total} {total === 1 ? "form" : "forms"}
                </p>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(page - 1)}
                        disabled={page <= 1}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= totalPages}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
