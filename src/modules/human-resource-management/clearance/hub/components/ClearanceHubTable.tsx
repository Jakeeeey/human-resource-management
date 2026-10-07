"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";
import { CLEARANCE_REQUEST_STATUS_LABELS, toClearanceDocumentChecklist, type ClearanceDocumentChecklist, type ClearanceRequestStatus } from "../types";
import type { ApprovableResignation, ClearanceHubRequest } from "../hooks/useClearanceHub";
import { DocumentCompletionBadge } from "./DocumentChecklist";
import styles from "./hub-status.module.css";

interface ClearanceHubTableProps {
    data: ClearanceHubRequest[];
    resignations: ApprovableResignation[];
    selectedId: number | null;
    completionByRequest: Map<number, ClearanceDocumentChecklist>;
    onRetry: () => Promise<void>;
    onClearFilters: () => void;
    canClearFilters: boolean;
    isLoading?: boolean;
    error?: string | null;
}

function statusTone(status: ClearanceRequestStatus): StatusTone {
    if (status === "completed") return "success";
    if (status === "in_progress") return "info";
    return "neutral";
}

function statusClassName(status: ClearanceRequestStatus): string {
    return status === "completed" ? styles.signed : styles.pending;
}

export function ClearanceHubTable({
    data,
    resignations,
    selectedId,
    completionByRequest,
    onRetry,
    onClearFilters,
    canClearFilters,
    isLoading = false,
    error = null,
}: ClearanceHubTableProps) {
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState(1);
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const pageSize = 10;

    const namesByResignation = useMemo(() => {
        const map = new Map<number, string>();
        for (const resignation of resignations) {
            map.set(resignation.id, resignation.employee_name);
        }
        return map;
    }, [resignations]);

    const sortedData = useMemo(() => {
        const rows = [...data];
        rows.sort((left, right) => {
            const leftName = namesByResignation.get(left.resignation_id) ?? "";
            const rightName = namesByResignation.get(right.resignation_id) ?? "";
            const compared = leftName.localeCompare(rightName);
            if (compared !== 0) return sortDirection === "asc" ? compared : -compared;
            return left.id - right.id;
        });
        return rows;
    }, [data, namesByResignation, sortDirection]);

    const totalItems = sortedData.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const displayedData = sortedData.slice(startIndex, startIndex + pageSize);

    const handleSortToggle = () => {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        setCurrentPage(1);
    };

    if (isLoading) {
        return (
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-13 w-full" />
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

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <p className="font-medium">No clearance requests found.</p>
                <p className="text-sm text-muted-foreground">
                    {canClearFilters
                        ? "No results match the current search or filters."
                        : "Nothing has been filed yet."}
                </p>
                {canClearFilters && (
                    <Button variant="outline" size="sm" onClick={onClearFilters} className="mt-2">
                        Clear search and filters
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="max-h-120 overflow-auto rounded-md border">
                <table className="w-full min-w-150 table-fixed caption-bottom text-sm">
                    <colgroup>
                        <col />
                        <col />
                        <col className="w-36" />
                        <col className="w-32" />
                    </colgroup>
                    <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                        <TableRow>
                            <TableHead
                                aria-sort={sortDirection === "asc" ? "ascending" : "descending"}
                                className="h-12 bg-card px-4"
                            >
                                <button
                                    type="button"
                                    onClick={handleSortToggle}
                                    aria-label={`Sort by employee, ${sortDirection === "asc" ? "descending" : "ascending"}`}
                                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                                >
                                    Employee
                                    {sortDirection === "asc" ? (
                                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                                    ) : (
                                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                                    )}
                                </button>
                            </TableHead>
                            <TableHead className="h-12 bg-card px-4">Template</TableHead>
                            <TableHead className="h-12 bg-card px-4">Documents</TableHead>
                            <TableHead className="h-12 bg-card px-4">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayedData.map((request) => {
                            const employeeName = namesByResignation.get(request.resignation_id) ?? "Unknown employee";
                            const isActive = selectedId === request.id;
                            const checklist = completionByRequest.get(request.id) ?? toClearanceDocumentChecklist(request.id);
                            return (
                                <TableRow
                                    key={request.id}
                                    aria-selected={isActive}
                                    tabIndex={0}
                                    onClick={() => router.push(`/hrm/clearance/hub/${request.id}`)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            router.push(`/hrm/clearance/hub/${request.id}`);
                                        }
                                    }}
                                    className={cn(
                                        "cursor-pointer hover:bg-muted/50",
                                        isActive && "border-primary/30 bg-primary/5 hover:bg-primary/10"
                                    )}
                                >
                                    <TableCell className="truncate px-4 py-4 font-medium" title={employeeName}>
                                        <Link
                                            href={`/hrm/clearance/hub/${request.id}`}
                                            onClick={(event) => event.stopPropagation()}
                                            className="underline-offset-4 hover:underline"
                                        >
                                            {employeeName}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="truncate px-4 py-4" title={request.template_title_snapshot ?? "Unknown template"}>
                                        {request.template_title_snapshot ?? "Unknown template"}
                                    </TableCell>
                                    <TableCell className="px-4 py-4">
                                        <DocumentCompletionBadge checklist={checklist} />
                                    </TableCell>
                                    <TableCell className="px-4 py-4">
                                        <StatusBadge tone={statusTone(request.status)} className={statusClassName(request.status)}>
                                            {CLEARANCE_REQUEST_STATUS_LABELS[request.status]}
                                        </StatusBadge>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                        Page {safePage} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                if (safePage > 1) {
                                    setCurrentPage(safePage - 1);
                                }
                            }}
                            disabled={safePage === 1}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                if (safePage < totalPages) {
                                    setCurrentPage(safePage + 1);
                                }
                            }}
                            disabled={safePage === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
