"use client";

import { useCallback, useEffect, useState } from "react";

import { ClearanceSoaOverviewSchema, type ClearanceSoaOverview } from "../types";

export type SoaStatusFilter = "all" | "missing" | "draft" | "issued";

const LIST_API = "/api/hrm/clearance/soa";
const PAGE_SIZE = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function toId(value: unknown): number | null {
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isInteger(parsed) ? parsed : null;
    }
    return null;
}

function normalizeRow(raw: unknown): ClearanceSoaOverview | null {
    const parsed = ClearanceSoaOverviewSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
}

export function useSoaList() {
    const [rows, setRows] = useState<ClearanceSoaOverview[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState<SoaStatusFilter>("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (nextPage: number, nextStatus: SoaStatusFilter) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: String(nextPage),
                limit: String(PAGE_SIZE),
            });
            if (nextStatus !== "all") params.set("status", nextStatus);
            const res = await fetch(`${LIST_API}?${params.toString()}`);
            const json: unknown = await res.json().catch(() => null);
            if (!res.ok || !isRecord(json) || json.success !== true || !Array.isArray(json.data)) {
                throw new Error("Could not load statements of account. Please try again.");
            }
            const parsed: ClearanceSoaOverview[] = [];
            for (const entry of json.data as unknown[]) {
                const row = normalizeRow(entry);
                if (row) parsed.push(row);
            }
            setRows(parsed);
            setTotal(typeof json.total === "number" ? json.total : parsed.length);
        } catch {
            setError("Could not load statements of account. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(page, status);
    }, [load, page, status]);

    const reload = useCallback(() => {
        void load(page, status);
    }, [load, page, status]);

    const changeStatus = useCallback((next: SoaStatusFilter) => {
        setStatus(next);
        setPage(1);
    }, []);

    const ensureForRequest = useCallback(async (requestId: number): Promise<number> => {
        const res = await fetch(LIST_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ request_id: requestId }),
        });
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok || !isRecord(json) || json.success !== true || !isRecord(json.data)) {
            const message = isRecord(json) && typeof json.message === "string"
                ? json.message
                : "Could not open a statement of account for this request.";
            throw new Error(message);
        }
        const requestRef = toId((json.data as Record<string, unknown>).request_id);
        if (requestRef === null) throw new Error("Could not open a statement of account for this request.");
        return requestRef;
    }, []);

    return {
        rows,
        total,
        page,
        limit: PAGE_SIZE,
        status,
        loading,
        error,
        setPage,
        changeStatus,
        reload,
        ensureForRequest,
    };
}
