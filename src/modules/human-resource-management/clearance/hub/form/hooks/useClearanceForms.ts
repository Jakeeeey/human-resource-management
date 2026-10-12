"use client";

import { useCallback, useEffect, useState } from "react";

import { ClearanceFormOverviewSchema, type ClearanceFormOverview } from "../types";

export type ClearanceFormStatusFilter = "all" | "missing" | "pending" | "approved";

const PAGE_SIZE = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function toOverviewRow(entry: unknown): ClearanceFormOverview | null {
    const parsed = ClearanceFormOverviewSchema.safeParse(entry);
    return parsed.success ? parsed.data : null;
}

export function useClearanceForms() {
    const [rows, setRows] = useState<ClearanceFormOverview[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState<ClearanceFormStatusFilter>("all");
    const [nonce, setNonce] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        (async () => {
            try {
                const params = new URLSearchParams({
                    page: String(page),
                    limit: String(PAGE_SIZE),
                });
                if (status !== "all") params.set("status", status);
                const res = await fetch(`/api/hrm/clearance/form?${params.toString()}`);
                if (!res.ok) throw new Error("list failed");
                const body: unknown = await res.json().catch(() => null);
                if (!isRecord(body) || body.success !== true || !Array.isArray(body.data)) {
                    throw new Error("list failed");
                }
                const next: ClearanceFormOverview[] = [];
                for (const entry of body.data) {
                    const row = toOverviewRow(entry);
                    if (row) next.push(row);
                }
                if (cancelled) return;
                setRows(next);
                setTotal(typeof body.total === "number" ? body.total : next.length);
            } catch {
                if (!cancelled) setError("Could not load clearance forms. Please try again.");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [page, status, nonce]);

    const refresh = useCallback(() => {
        setNonce((value) => value + 1);
    }, []);

    const changeStatus = useCallback((next: ClearanceFormStatusFilter) => {
        setStatus(next);
        setPage(1);
    }, []);

    const goToPage = useCallback((next: number) => {
        setPage(next);
    }, []);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return {
        rows,
        total,
        page,
        limit: PAGE_SIZE,
        totalPages,
        status,
        changeStatus,
        goToPage,
        isLoading,
        error,
        refresh,
    };
}
