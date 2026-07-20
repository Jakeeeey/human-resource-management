"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { PendingApprovalItem } from "../types";
import { ApprovalService } from "../services/ApprovalService";

interface ApprovalsFetchContextType {
    pendingItems: PendingApprovalItem[];
    isLoading: boolean;
    refetch: () => Promise<void>;
    processSchedule: (scheduleId: number, status: "APPROVED" | "REJECTED", userId: number | null, reason?: string | null) => Promise<boolean>;
}

const ApprovalsFetchContext = createContext<ApprovalsFetchContextType | undefined>(undefined);

export function ApprovalsFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [pendingItems, setPendingItems] = useState<PendingApprovalItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchPending = useCallback(async () => {
        try {
            setIsLoading(true);
            const items = await ApprovalService.getPendingApprovals();
            setPendingItems(items);
        } catch (err) {
            console.error("Failed fetching pending approvals", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPending();
    }, [fetchPending]);

    const processSchedule = async (scheduleId: number, status: "APPROVED" | "REJECTED", userId: number | null, reason?: string | null) => {
        const success = await ApprovalService.processScheduleStatus(scheduleId, status, userId, reason);
        if (success) {
            await fetchPending();
        }
        return success;
    };

    return React.createElement(
        ApprovalsFetchContext.Provider,
        {
            value: {
                pendingItems,
                isLoading,
                refetch: fetchPending,
                processSchedule,
            },
        },
        children
    );
}

export function useApprovalsFetchContext() {
    const ctx = useContext(ApprovalsFetchContext);
    if (!ctx) {
        throw new Error("Must be used inside ApprovalsFetchProvider");
    }
    return ctx;
}
