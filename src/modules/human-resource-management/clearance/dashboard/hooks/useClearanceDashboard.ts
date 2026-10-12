"use client";

import * as React from "react";

import type { ClearanceDashboardBundle } from "../types/clearance-dashboard.schema";
import { ClearanceDashboardClientError } from "../providers/clearanceDashboardClient";

export interface ClearanceDashboardState {
    readonly data: ClearanceDashboardBundle | null;
    readonly isLoading: boolean;
    readonly refreshing: boolean;
    readonly error: string | null;
    readonly refresh: () => Promise<void>;
}

const DASHBOARD_PATH: string = "/api/hrm/clearance/dashboard";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ClearanceDashboardPeriod = "all" | "30d" | "90d" | "12m";

function periodQuery(period: ClearanceDashboardPeriod): string {
    if (period === "all") return "";
    const days = period === "30d" ? 30 : period === "90d" ? 90 : 365;
    const to = new Date();
    const from = new Date(to.getTime() - days * DAY_MS);
    return `?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}&period=${period}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object";
}

function readBundle(body: unknown): ClearanceDashboardBundle {
    if (!isRecord(body)) {
        throw new ClearanceDashboardClientError(500, "The dashboard returned data in an unexpected shape.");
    }
    if (body["success"] === false) {
        const message = typeof body["message"] === "string" && body["message"].length > 0
            ? body["message"]
            : "Failed to load the clearance dashboard.";
        throw new ClearanceDashboardClientError(500, message);
    }
    const payload: unknown = "data" in body ? body["data"] : body;
    if (!isRecord(payload) || !isRecord(payload["kpis"]) || !Array.isArray(payload["trend"])) {
        throw new ClearanceDashboardClientError(500, "The dashboard returned data in an unexpected shape.");
    }
    return payload as unknown as ClearanceDashboardBundle;
}

export function useClearanceDashboard(period: ClearanceDashboardPeriod = "all"): ClearanceDashboardState {
    const [data, setData] = React.useState<ClearanceDashboardBundle | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const mountedRef = React.useRef(false);
    const hasDataRef = React.useRef(false);

    React.useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const refresh = React.useCallback(async (): Promise<void> => {
        if (mountedRef.current) {
            if (hasDataRef.current) {
                setRefreshing(true);
            } else {
                setIsLoading(true);
            }
            setError(null);
        } else if (!hasDataRef.current) {
            setIsLoading(true);
            setError(null);
        }
        try {
            const res = await fetch(`${DASHBOARD_PATH}${periodQuery(period)}`, { cache: "no-store" });
            const body: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                const message = isRecord(body) && typeof body["message"] === "string"
                    ? (body["message"] as string)
                    : `Request failed with status ${res.status}.`;
                throw new ClearanceDashboardClientError(res.status, message);
            }
            const bundle = readBundle(body);
            hasDataRef.current = true;
            if (!mountedRef.current) return;
            setData(bundle);
        } catch (err) {
            if (!mountedRef.current) return;
            setError(
                err instanceof ClearanceDashboardClientError
                    ? err.message
                    : "Failed to load the clearance dashboard."
            );
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
                setRefreshing(false);
            }
        }
    }, [period]);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    return { data, isLoading, refreshing, error, refresh };
}
