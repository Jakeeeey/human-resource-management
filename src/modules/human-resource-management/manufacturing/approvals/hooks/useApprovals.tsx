"use client";

import { useState } from "react";
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
        return isNaN(parsed) ? null : parsed;
    } catch {
        return null;
    }
}

export function useApprovals() {
    const {
        pendingItems,
        isLoading,
        refetch,
        processSchedule,
    } = useApprovalsFetchContext();

    const [isRejectOpen, setIsRejectOpen] = useState(false);
    const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);

    const handleApprove = async (scheduleId: number) => {
        const userId = getUserIdFromCookie();
        try {
            const success = await processSchedule(scheduleId, "APPROVED", userId);
            if (success) {
                toast.success("Schedule override approved successfully");
            } else {
                toast.error("Failed to approve schedule");
            }
        } catch (error) {
            console.error("Approval error:", error);
            toast.error("An unexpected error occurred");
        }
    };

    const promptReject = (scheduleId: number) => {
        setRejectTargetId(scheduleId);
        setIsRejectOpen(true);
    };

    const handleRejectConfirm = async (reason: string) => {
        if (!rejectTargetId) return;
        const userId = getUserIdFromCookie();
        try {
            const success = await processSchedule(rejectTargetId, "REJECTED", userId, reason);
            if (success) {
                toast.success("Schedule override rejected successfully");
                setIsRejectOpen(false);
                setRejectTargetId(null);
            } else {
                toast.error("Failed to reject schedule");
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
        promptReject,
        isRejectOpen,
        setIsRejectOpen,
        handleRejectConfirm,
    };
}
