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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";
import { CLEARANCE_REQUEST_STATUS_LABELS, toClearanceDocumentChecklist, type ClearanceDocumentChecklist, type ClearanceRequestStatus } from "../types";
import type { ApprovableResignation, ClearanceHubRequest } from "../hooks/useClearanceHub";
import { formatPHT } from "../utils/time";
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
    currentPage: number;
    onPageChange: (page: number) => void;
    isLoading?: boolean;
    error?: string | null;
    total?: number;
    pageSize?: number;
    onPageSizeChange?: (pageSize: number) => void;
    sortKey?: SortKey;
    sortDirection?: "asc" | "desc";
    onSortChange?: (key: SortKey, direction: "asc" | "desc") => void;
}

export type SortKey = "employee" | "filed";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function statusTone(status: ClearanceRequestStatus): StatusTone {
    if (status === "completed") return "success";
    if (status === "in_progress") return "info";
    return "neutral";
}

function statusClassName(status: ClearanceRequestStatus): string {
    return status === "completed" ? styles.signed : styles.pending;
}

function filedLabel(createdAt: string | null): string {
    if (!createdAt) return "—";
    return formatPHT(createdAt, { includeTime: false });
}

export function ClearanceHubTable({
    data,
    resignations,
    selectedId,
    completionByRequest,
    onRetry,
    onClearFilters,
    canClearFilters,
    currentPage,
    onPageChange,
    isLoading = false,
    error = null,
    total,
    pageSize: pageSizeProp,
    onPageSizeChange,
    sortKey: sortKeyProp,
    sortDirection: sortDirectionProp,
    onSortChange,
}: ClearanceHubTableProps) {
    const router = useRouter();
    const serverDriven = total !== undefined;
    const [internalPageSize, setInternalPageSize] = useState(10);
    const [internalSortKey, setInternalSortKey] = useState<SortKey>("employee");
    const [internalSortDirection, setInternalSortDirection] = useState<"asc" | "desc">("asc");
    const pageSize = pageSizeProp ?? internalPageSize;
    const sortKey = sortKeyProp ?? internalSortKey;
    const sortDirection = sortDirectionProp ?? internalSortDirection;

    const namesByResignation = useMemo(() => {
        const map = new Map<number, string>();
        for (const resignation of resignations) {
            map.set(resignation.id, resignation.employee_name);
        }
        return map;
    }, [resignations]);

    const orderedData = useMemo(() => {
        if (serverDriven) {
            if (sortKey !== "employee") return data;
            const rows = [...data];
            rows.sort((left, right) => {
                const leftName = namesByResignation.get(left.resignation_id) ?? "";
                const rightName = namesByResignation.get(right.resignation_id) ?? "";
                const compared = leftName.localeCompare(rightName);
                if (compared !== 0) return sortDirection === "asc" ? compared : -compared;
                return left.id - right.id;
            });
            return rows;
        }
        const rows = [...data];
        rows.sort((left, right) => {
            let compared = 0;
            if (sortKey === "filed") {
                const leftFiled = left.created_at ?? "";
                const rightFiled = right.created_at ?? "";
                if (leftFiled === "" && rightFiled !== "") return 1;
                if (rightFiled === "" && leftFiled !== "") return -1;
                compared = leftFiled.localeCompare(rightFiled);
            } else {
                const leftName = namesByResignation.get(left.resignation_id) ?? "";
                const rightName = namesByResignation.get(right.resignation_id) ?? "";
                compared = leftName.localeCompare(rightName);
            }
            if (compared !== 0) return sortDirection === "asc" ? compared : -compared;
            return left.id - right.id;
        });
        return rows;
    }, [data, namesByResignation, serverDriven, sortKey, sortDirection]);

    const totalItems = total ?? orderedData.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const displayedData = serverDriven ? orderedData : orderedData.slice(startIndex, startIndex + pageSize);

    const handleSortToggle = (key: SortKey) => {
        if (sortKeyProp !== undefined && onSortChange !== undefined) {
            onSortChange(key, key === sortKeyProp ? (sortDirectionProp === "asc" ? "desc" : "asc") : "asc");
        } else if (key === internalSortKey) {
            setInternalSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setInternalSortKey(key);
            setInternalSortDirection("asc");
        }
        onPageChange(1);
    };

    const handlePageSizeChange = (value: string) => {
        if (onPageSizeChange !== undefined) {
            onPageSizeChange(Number(value));
        } else {
            setInternalPageSize(Number(value));
        }
        onPageChange(1);
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
            <ul className="space-y-3 xl:hidden">
                {displayedData.map((request) => {
                    const employeeName = namesByResignation.get(request.resignation_id) ?? "Unknown employee";
                    const isActive = selectedId === request.id;
                    const checklist = completionByRequest.get(request.id) ?? toClearanceDocumentChecklist(request.id);
                    return (
                        <li
                            key={request.id}
                            className={cn(
                                "rounded-md border bg-card p-4",
                                isActive && "border-primary/30 bg-primary/5"
                            )}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <Link
                                    href={`/hrm/clearance/hub/${request.id}`}
                                    className="min-w-0 flex-1 font-medium break-words underline-offset-4 hover:underline"
                                >
                                    {employeeName}
                                </Link>
                                <StatusBadge tone={statusTone(request.status)} className={statusClassName(request.status)}>
                                    {CLEARANCE_REQUEST_STATUS_LABELS[request.status]}
                                </StatusBadge>
                            </div>
                            <dl className="mt-2 space-y-1 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <dt className="shrink-0 text-muted-foreground">Template</dt>
                                    <dd className="min-w-0 flex-1 text-right break-words">
                                        {request.template_title_snapshot ?? "Unknown template"}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <dt className="shrink-0 text-muted-foreground">Filed</dt>
                                    <dd className="min-w-0 flex-1 text-right break-words tabular-nums">
                                        {filedLabel(request.created_at)}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <dt className="shrink-0 text-muted-foreground">Documents</dt>
                                    <dd>
                                        <DocumentCompletionBadge checklist={checklist} />
                                    </dd>
                                </div>
                            </dl>
                        </li>
                    );
                })}
            </ul>
            <div className="hidden overflow-x-auto rounded-md border xl:block">
                <table className="w-full min-w-150 table-fixed caption-bottom text-sm">
                    <colgroup>
                        <col />
                        <col />
                        <col className="w-36" />
                        <col className="w-36" />
                        <col className="w-32" />
                    </colgroup>
                    <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                        <TableRow>
                            <TableHead
                                aria-sort={sortKey === "employee" ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}
                                className="h-12 bg-card px-4"
                            >
                                <button
                                    type="button"
                                    onClick={() => handleSortToggle("employee")}
                                    aria-label={`Sort by employee, ${sortKey === "employee" && sortDirection === "asc" ? "descending" : "ascending"}`}
                                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                                >
                                    Employee
                                    {sortKey === "employee" ? (
                                        sortDirection === "asc" ? (
                                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                                        ) : (
                                            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                                        )
                                    ) : null}
                                </button>
                            </TableHead>
                            <TableHead className="h-12 bg-card px-4">Template</TableHead>
                            <TableHead
                                aria-sort={sortKey === "filed" ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}
                                className="h-12 bg-card px-4"
                            >
                                <button
                                    type="button"
                                    onClick={() => handleSortToggle("filed")}
                                    aria-label={`Sort by filed date, ${sortKey === "filed" && sortDirection === "asc" ? "descending" : "ascending"}`}
                                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                                >
                                    Filed
                                    {sortKey === "filed" ? (
                                        sortDirection === "asc" ? (
                                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                                        ) : (
                                            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                                        )
                                    ) : null}
                                </button>
                            </TableHead>
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
                                    <TableCell className="whitespace-nowrap px-4 py-4 tabular-nums" title={request.created_at ?? "No filed date"}>
                                        {filedLabel(request.created_at)}
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
                <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                        Page {safePage} of {totalPages}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor="hub-page-size" className="text-sm text-muted-foreground">
                            Rows per page
                        </label>
                        <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                            <SelectTrigger id="hub-page-size" className="w-24">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {PAGE_SIZE_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={String(option)}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            aria-label="Go to previous page"
                            onClick={() => {
                                if (safePage > 1) {
                                    onPageChange(safePage - 1);
                                }
                            }}
                            disabled={safePage === 1}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            aria-label="Go to next page"
                            onClick={() => {
                                if (safePage < totalPages) {
                                    onPageChange(safePage + 1);
                                }
                            }}
                            disabled={safePage === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </nav>
            )}
        </div>
    );
}
