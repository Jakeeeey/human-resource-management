"use client";

import { useApprovalsFetchContext } from "../providers/fetchProvider";
import { toast } from "sonner";

function getUserIdFromCookie(): number | null {
    if (typeof window === "undefined") return null;
    const match = document.cookie.match(/vos_access_token=([^;]+)/);
    if (!match) return null;
    try {
        const token = match[1];
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        const userId = payload.id || payload.sub || payload.user_id;
        const parsed = parseInt(userId, 10);
        return isNaN(parsed) ? 1 : parsed;
    } catch {
        return 1;
    }
}

export function useApprovals() {
    const {
        pendingItems,
        isLoading,
        refetch,
        processTarget,
        processHeadcount,
    } = useApprovalsFetchContext();

    const handleApprove = async (id: string, type: "target" | "headcount", refId: number) => {
        const userId = getUserIdFromCookie() || 1;
        let success = false;
        try {
            if (type === "target") {
                success = await processTarget(refId, "APPROVED", userId);
            } else {
                success = await processHeadcount(refId, "APPROVED", userId);
            }

            if (success) {
                toast.success("Override request approved successfully");
            } else {
                toast.error("Failed to approve override request");
            }
        } catch (error) {
            console.error("Approval error:", error);
            toast.error("An unexpected error occurred");
        }
    };

    const handleReject = async (id: string, type: "target" | "headcount", refId: number) => {
        const userId = getUserIdFromCookie() || 1;
        let success = false;
        try {
            if (type === "target") {
                success = await processTarget(refId, "REJECTED", userId);
            } else {
                success = await processHeadcount(refId, "REJECTED", userId);
            }

            if (success) {
                toast.success("Override request rejected successfully");
            } else {
                toast.error("Failed to reject override request");
            }
        } catch (error) {
            console.error("Rejection error:", error);
            toast.error("An unexpected error occurred");
        }
    };

    return {
        pendingItems,
        isLoading,
        refetch,
        handleApprove,
        handleReject,
    };
}
