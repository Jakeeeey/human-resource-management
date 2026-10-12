"use client";

import { useCallback, useState } from "react";
import type { ResignationListResponse, ResignationRequestWithUser } from "../types";

const API_BASE = "/api/hrm/resignation/resignation-approval";

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
    const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
    return typeof payload?.error === "string" ? payload.error : fallback;
}

export function useResignationApproval() {
    const [requests, setRequests] = useState<ResignationRequestWithUser[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(API_BASE, {
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

    const reviewRequest = useCallback(
        async (id: number, status: "approved" | "rejected", remarks: string): Promise<string> => {
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

    const approveRequest = useCallback(
        (id: number, remarks: string): Promise<string> => reviewRequest(id, "approved", remarks),
        [reviewRequest]
    );

    const rejectRequest = useCallback(
        (id: number, remarks: string): Promise<string> => reviewRequest(id, "rejected", remarks),
        [reviewRequest]
    );

    return {
        requests,
        isLoading,
        error,
        refresh,
        approveRequest,
        rejectRequest,
    };
}
