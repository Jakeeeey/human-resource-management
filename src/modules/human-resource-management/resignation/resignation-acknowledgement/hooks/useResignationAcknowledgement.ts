"use client";

import { useCallback, useRef, useState } from "react";
import type { ResignationListResponse, ResignationRequestWithUser } from "../types";

const API_BASE = "/api/hrm/resignation/resignation-acknowledgement";

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
    const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
    return typeof payload?.error === "string" ? payload.error : fallback;
}

export function useResignationAcknowledgement() {
    const [requests, setRequests] = useState<ResignationRequestWithUser[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [includeInactive, setIncludeInactiveState] = useState<boolean>(false);
    const includeInactiveRef = useRef<boolean>(false);

    const refresh = useCallback(async (inactive?: boolean): Promise<void> => {
        const includeInactiveValue = inactive ?? includeInactiveRef.current;
        includeInactiveRef.current = includeInactiveValue;
        setIsLoading(true);
        setError(null);
        try {
            const url = includeInactiveValue ? `${API_BASE}?include_inactive=1` : API_BASE;
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                cache: "no-store",
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to fetch resignation requests"));
            }
            const payload = (await response.json()) as ResignationListResponse;
            setRequests(payload.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch resignation requests");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const setIncludeInactive = useCallback(
        (value: boolean): void => {
            setIncludeInactiveState(value);
            includeInactiveRef.current = value;
            void refresh(value);
        },
        [refresh]
    );

    const reviewRequest = useCallback(
        async (id: number, status: "approved" | "withdrawn", remarks: string): Promise<string> => {
            const response = await fetch(API_BASE, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ id, status, remarks }),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to update resignation request"));
            }
            const payload = (await response.json()) as { success: boolean; message: string };
            await refresh();
            return payload.message;
        },
        [refresh]
    );

    const acknowledgeRequest = useCallback(
        (id: number, remarks: string): Promise<string> => reviewRequest(id, "approved", remarks),
        [reviewRequest]
    );

    const withdrawRequest = useCallback(
        (id: number, remarks: string): Promise<string> => reviewRequest(id, "withdrawn", remarks),
        [reviewRequest]
    );

    return {
        requests,
        isLoading,
        error,
        includeInactive,
        refresh,
        setIncludeInactive,
        acknowledgeRequest,
        withdrawRequest,
    };
}
