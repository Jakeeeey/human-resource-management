"use client";

import type { JSX } from "react";
import { useEffect, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useSoaList, type SoaStatusFilter } from "../hooks/useSoaList";
import type { ClearanceSoaOverview } from "../types";

interface SoaListProps {
    selectedRequestId: number | null;
    onOpen: (requestId: number) => void;
    refreshSignal?: number;
}

function displayValue(value: string | null): string {
    return value === null || value.trim() === "" ? "—" : value;
}

function statusTone(status: ClearanceSoaOverview["status"]): StatusTone {
    if (status === "issued") return "success";
    if (status === "draft") return "info";
    return "neutral";
}

function statusLabel(status: ClearanceSoaOverview["status"]): string {
    if (status === "issued") return "Issued";
    if (status === "draft") return "Draft";
    return "Missing";
}

export function SoaList({ selectedRequestId, onOpen, refreshSignal = 0 }: SoaListProps): JSX.Element {
    const {
        rows,
        total,
        page,
        limit,
        status,
        loading,
        error,
        setPage,
        changeStatus,
        reload,
    } = useSoaList();

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const lastRefreshSignal = useRef(refreshSignal);

    useEffect(() => {
        if (refreshSignal !== lastRefreshSignal.current) {
            lastRefreshSignal.current = refreshSignal;
            reload();
        }
    }, [refreshSignal, reload]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <Select
                    value={status}
                    onValueChange={(next) => changeStatus(next as SoaStatusFilter)}
                >
                    <SelectTrigger className="w-32" aria-label="Filter by status">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="missing">Missing</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="issued">Issued</SelectItem>
                    </SelectContent>
                </Select>
                <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
                    Showing <span className="font-semibold">{rows.length}</span>{" "}
                    of <span className="font-semibold">{total}</span>{" "}
                    {total === 1 ? "statement of account" : "statements of account"}
                </p>
            </div>
            {error && (
                <div className="space-y-4">
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    <Button onClick={reload} variant="outline">
                        Retry
                    </Button>
                </div>
            )}
            {!error && loading && rows.length === 0 && (
                <div className="space-y-2">
                    {[...Array(5)].map((_, index) => (
                        <Skeleton key={index} className="h-13 w-full" />
                    ))}
                </div>
            )}
            {!error && !loading && rows.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <p className="font-medium">No statements of account found.</p>
                    <p className="text-sm text-muted-foreground">
                        {status === "all"
                            ? "Nothing has been filed yet."
                            : "No statements match the current status filter."}
                    </p>
                </div>
            )}
            {!error && !loading && rows.length > 0 && (
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
                                <TableHead className="h-12 bg-card px-4">Ref No.</TableHead>
                                <TableHead className="h-12 bg-card px-4">Clearance No.</TableHead>
                                <TableHead className="h-12 bg-card px-4">Status</TableHead>
                                <TableHead className="h-12 bg-card px-4 text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => {
                                const isActive = selectedRequestId === row.request_id;
                                return (
                                    <TableRow
                                        key={row.request_id}
                                        aria-selected={isActive}
                                        className={cn(
                                            "hover:bg-muted/50",
                                            isActive && "border-primary/30 bg-primary/5 hover:bg-primary/10"
                                        )}
                                    >
                                        <TableCell className="px-4 py-4 font-medium tabular-nums">
                                            #{row.request_id}
                                        </TableCell>
                                        <TableCell className="truncate px-4 py-4" title={row.employee_name}>
                                            {displayValue(row.employee_name)}
                                        </TableCell>
                                        <TableCell className="truncate px-4 py-4" title={row.ref_no ?? ""}>
                                            {displayValue(row.ref_no)}
                                        </TableCell>
                                        <TableCell className="truncate px-4 py-4" title={row.clearance_no ?? ""}>
                                            {displayValue(row.clearance_no)}
                                        </TableCell>
                                        <TableCell className="px-4 py-4">
                                            <StatusBadge tone={statusTone(row.status)}>
                                                {statusLabel(row.status)}
                                            </StatusBadge>
                                        </TableCell>
                                        <TableCell className="px-4 py-4 text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onOpen(row.request_id)}
                                            >
                                                Open
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </table>
                </div>
            )}
            {!error && !loading && total > 0 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                        Page {page} of {totalPages} · {total} total
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage(page - 1)}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage(page + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
