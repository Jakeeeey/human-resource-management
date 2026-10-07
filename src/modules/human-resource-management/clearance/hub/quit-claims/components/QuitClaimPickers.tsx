"use client";

import { useCallback, useEffect, useState } from "react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
    listEmployeeOptions,
    listResignationOptions,
    quitClaimErrorMessage,
    type EmployeeOption,
    type ResignationOption,
} from "../providers/quitClaimClient";

const PICKER_PAGE_SIZE = 10;

function pagerLabel(page: number, total: number, limit: number): string {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return `Page ${page} of ${totalPages}`;
}

export function EmployeePicker({
    value,
    onValueChange,
    disabled = false,
}: {
    value: EmployeeOption | null;
    onValueChange: (employee: EmployeeOption | null) => void;
    disabled?: boolean;
}): JSX.Element {
    const [search, setSearch] = useState("");
    const [appliedSearch, setAppliedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<EmployeeOption[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (nextPage: number, term: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await listEmployeeOptions({ page: nextPage, limit: PICKER_PAGE_SIZE, search: term });
            setRows(result.data);
            setTotal(result.total);
            setPage(result.page);
        } catch (loadError) {
            setError(quitClaimErrorMessage(loadError, "Failed to load employees."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(1, appliedSearch);
    }, [appliedSearch, load]);

    return (
        <div className="space-y-2">
            <Label>Employee</Label>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search employees…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                setAppliedSearch(search);
                            }
                        }}
                        className="pl-9"
                        disabled={disabled}
                    />
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => setAppliedSearch(search)}
                >
                    Search
                </Button>
            </div>
            {value && (
                <p className="text-xs text-muted-foreground" aria-live="polite">
                    Selected: <span className="font-medium text-foreground">{value.full_name}</span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-6 px-2 text-xs"
                        disabled={disabled}
                        onClick={() => onValueChange(null)}
                    >
                        Clear
                    </Button>
                </p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="max-h-52 overflow-y-auto rounded-md border">
                {loading ? (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">Loading employees…</p>
                ) : rows.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">No employees found.</p>
                ) : (
                    <ul className="divide-y">
                        {rows.map((row) => {
                            const selected = value?.user_id === row.user_id;
                            return (
                                <li key={row.user_id}>
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => onValueChange(row)}
                                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 ${selected ? "bg-primary/5 font-medium" : ""}`}
                                    >
                                        <span className="min-w-0 truncate">{row.full_name}</span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {row.user_position ?? ""}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground" aria-live="polite">
                    {pagerLabel(page, total, PICKER_PAGE_SIZE)} · {total} found
                </p>
                <div className="flex gap-1">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || loading || page <= 1}
                        onClick={() => void load(page - 1, appliedSearch)}
                        aria-label="Previous employee page"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || loading || page * PICKER_PAGE_SIZE >= total}
                        onClick={() => void load(page + 1, appliedSearch)}
                        aria-label="Next employee page"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function ResignationPicker({
    userId,
    value,
    onValueChange,
    disabled = false,
}: {
    userId: number | null;
    value: ResignationOption | null;
    onValueChange: (resignation: ResignationOption | null) => void;
    disabled?: boolean;
}): JSX.Element {
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<ResignationOption[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (nextPage: number, nextUserId: number | null) => {
        setLoading(true);
        setError(null);
        try {
            const result = await listResignationOptions({
                page: nextPage,
                limit: PICKER_PAGE_SIZE,
                userId: nextUserId ?? undefined,
            });
            setRows(result.data);
            setTotal(result.total);
            setPage(result.page);
        } catch (loadError) {
            setError(quitClaimErrorMessage(loadError, "Failed to load resignations."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setPage(1);
        void load(1, userId);
    }, [userId, load]);

    return (
        <div className="space-y-2">
            <Label>
                Resignation
                <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
            </Label>
            {value && (
                <p className="text-xs text-muted-foreground" aria-live="polite">
                    Selected:{" "}
                    <span className="font-medium text-foreground">
                        #{value.id} · {value.employee_name} · {value.resignation_date ?? "no separation date"}
                    </span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-6 px-2 text-xs"
                        disabled={disabled}
                        onClick={() => onValueChange(null)}
                    >
                        Clear
                    </Button>
                </p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="max-h-52 overflow-y-auto rounded-md border">
                {loading ? (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">Loading resignations…</p>
                ) : rows.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                        No approved resignations{userId !== null ? " for this employee" : ""}.
                    </p>
                ) : (
                    <ul className="divide-y">
                        {rows.map((row) => {
                            const selected = value?.id === row.id;
                            return (
                                <li key={row.id}>
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => onValueChange(row)}
                                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 ${selected ? "bg-primary/5 font-medium" : ""}`}
                                    >
                                        <span className="min-w-0 truncate">
                                            #{row.id} · {row.employee_name}
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {row.resignation_date ?? row.filed_at ?? ""}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground" aria-live="polite">
                    {pagerLabel(page, total, PICKER_PAGE_SIZE)} · {total} found
                </p>
                <div className="flex gap-1">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || loading || page <= 1}
                        onClick={() => void load(page - 1, userId)}
                        aria-label="Previous resignation page"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || loading || page * PICKER_PAGE_SIZE >= total}
                        onClick={() => void load(page + 1, userId)}
                        aria-label="Next resignation page"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
