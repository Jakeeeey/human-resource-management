"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { PendingApprovalItem } from "../types";
import { ApprovalService } from "../services/ApprovalService";

interface ApprovalsFetchContextType {
    pendingItems: PendingApprovalItem[];
    isLoading: boolean;
    refetch: () => Promise<void>;
    processTarget: (id: number, status: "APPROVED" | "REJECTED", userId: number | null) => Promise<boolean>;
    processHeadcount: (posItemId: number, status: "APPROVED" | "REJECTED", userId: number | null) => Promise<boolean>;
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

    const processTarget = async (id: number, status: "APPROVED" | "REJECTED", userId: number | null) => {
        const success = await ApprovalService.updateTargetStatus(id, status, userId);
        if (success) {
            await fetchPending();
        }
        return success;
    };

    const processHeadcount = async (posItemId: number, status: "APPROVED" | "REJECTED", userId: number | null) => {
        const success = await ApprovalService.updateHeadcountStatus(posItemId, status, userId);
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
                processTarget,
                processHeadcount,
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
