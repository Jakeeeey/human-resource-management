"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatPHT } from "../utils/time";
import {
    getQuitClaim,
    listQuitClaims,
    quitClaimErrorMessage,
    type ClearanceQuitclaim,
} from "../providers/quitClaimClient";

const LIST_PAGE_SIZE = 10;

type StatusFilter = "all" | "draft" | "issued";

interface QuitClaimListProps {
    refreshKey: number;
    onOpen: (id: number) => void;
}

export function QuitClaimList({ refreshKey, onOpen }: QuitClaimListProps): JSX.Element {
    const [status, setStatus] = useState<StatusFilter>("all");
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<ClearanceQuitclaim[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [names, setNames] = useState<Map<number, string>>(new Map());
    const namesRef = useRef<Map<number, string>>(new Map());

    const load = useCallback(async (nextPage: number, nextStatus: StatusFilter) => {
        setLoading(true);
        setError(null);
        try {
            const result = await listQuitClaims({ page: nextPage, limit: LIST_PAGE_SIZE, status: nextStatus });
            setRows(result.data);
            setTotal(result.total);
            setPage(result.page);
            const missing = result.data.filter((entry) => !namesRef.current.has(entry.id));
            if (missing.length > 0) {
                const settled = await Promise.all(
                    missing.map(async (entry) => {
                        try {
                            const detail = await getQuitClaim(entry.id);
                            const name = detail.values.identity.name.trim();
                            return { id: entry.id, name: name === "" ? `Employee #${entry.user_id}` : name };
                        } catch {
                            return { id: entry.id, name: `Employee #${entry.user_id}` };
                        }
                    })
                );
                const next = new Map(namesRef.current);
                for (const resolved of settled) {
                    next.set(resolved.id, resolved.name);
                }
                namesRef.current = next;
                setNames(next);
            }
            } catch (loadError) {
                setError(quitClaimErrorMessage(loadError, "Failed to load quit claims."));
            } finally {
                setLoading(false);
            }
        },
        []
    );

    useEffect(() => {
        void load(page, status);
    }, [load, page, status, refreshKey]);

    const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));

    function handleStatusChange(next: StatusFilter): void {
        setStatus(next);
        setPage(1);
    }

    if (loading && rows.length === 0) {
        return (
            <div className="space-y-2">
                {[...Array(5)].map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                ))}
            </div>
        );
    }

    if (error && rows.length === 0) {
        return (
            <div className="space-y-4">
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button onClick={() => void load(page, status)} variant="outline">
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <Select value={status} onValueChange={(next) => handleStatusChange(next as StatusFilter)}>
                    <SelectTrigger className="w-44" aria-label="Filter by status">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="issued">Issued</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                    {total} quit claim{total === 1 ? "" : "s"}
                </p>
            </div>
            {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <p className="font-medium">No quit claims found.</p>
                    <p className="text-sm text-muted-foreground">
                        {status !== "all" ? "No results match the current filter." : "Nothing has been filed yet."}
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ref No.</TableHead>
                                <TableHead>Employee</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((entry) => (
                                <TableRow key={entry.id}>
                                    <TableCell className="font-medium">{entry.ref_no ?? "—"}</TableCell>
                                    <TableCell>{names.get(entry.id) ?? `Employee #${entry.user_id}`}</TableCell>
                                    <TableCell>
                                        <StatusBadge tone={entry.status === "issued" ? "success" : "neutral"}>
                                            {entry.status}
                                        </StatusBadge>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-muted-foreground">
                                        {formatPHT(entry.created_at, { includeTime: false })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => onOpen(entry.id)}>
                                            Open
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                        Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage(page - 1)}
                        >
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages || loading}
                            onClick={() => setPage(page + 1)}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
