"use client";

import * as React from "react";

import type { PerformanceDashboardBundle } from "../types/performance-dashboard.schema";
import { EvaluationClientError } from "../providers/evaluationClient";

export interface PerformanceDashboardState {
    readonly data: PerformanceDashboardBundle | null;
    readonly isLoading: boolean;
    readonly refreshing: boolean;
    readonly error: string | null;
    readonly refresh: () => Promise<void>;
}

const DASHBOARD_PATH: string = "/api/hrm/performance-evaluation/dashboard";

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object";
}

function readBundle(body: unknown): PerformanceDashboardBundle {
    if (!isRecord(body)) {
        throw new EvaluationClientError(500, "The dashboard returned data in an unexpected shape.");
    }
    if (body["success"] === false) {
        const message = typeof body["message"] === "string" && body["message"].length > 0
            ? body["message"]
            : "Failed to load the performance dashboard.";
        throw new EvaluationClientError(500, message);
    }
    const payload: unknown = "data" in body ? body["data"] : body;
    if (!isRecord(payload) || !isRecord(payload["kpis"]) || !Array.isArray(payload["trend"])) {
        throw new EvaluationClientError(500, "The dashboard returned data in an unexpected shape.");
    }
    return payload as unknown as PerformanceDashboardBundle;
}

export function usePerformanceDashboard(): PerformanceDashboardState {
    const [data, setData] = React.useState<PerformanceDashboardBundle | null>(null);
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
            const res = await fetch(DASHBOARD_PATH, { cache: "no-store" });
            const body: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                const message = isRecord(body) && typeof body["message"] === "string"
                    ? (body["message"] as string)
                    : `Request failed with status ${res.status}.`;
                throw new EvaluationClientError(res.status, message);
            }
            const bundle = readBundle(body);
            hasDataRef.current = true;
            if (!mountedRef.current) return;
            setData(bundle);
        } catch (err) {
            if (!mountedRef.current) return;
            setError(
                err instanceof EvaluationClientError
                    ? err.message
                    : "Failed to load the performance dashboard."
            );
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    return { data, isLoading, refreshing, error, refresh };
}
