"use client";

import { useState } from "react";
import { useSchedulingFetchContext } from "../providers/fetchProvider";
import type { ProductionSchedule, ScheduleFormValues } from "../types";
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
        const userId = payload.id || payload.sub || payload.user_id || payload.id;
        // Directus uuid string can fail if DB expects INT for user_id.
        // If it's a UUID string, check if it's numeric, or fall back to a dummy integer or parsed integer
        const parsed = parseInt(userId, 10);
        return isNaN(parsed) ? 1 : parsed; // Fallback to 1 if it's a UUID string and table expects INT
    } catch {
        return 1;
    }
}

export function useScheduling() {
    const {
        schedules,
        lines,
        isLoading,
        refetch,
        addSchedule,
        updateSchedule,
        removeSchedule,
        approveTarget,
        approveHeadcount,
    } = useSchedulingFetchContext();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState<ProductionSchedule | null>(null);

    // Delete dialog
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Save loading state
    const [isSaving, setIsSaving] = useState(false);

    const handleAdd = () => {
        setSelectedSchedule(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (schedule: ProductionSchedule) => {
        setSelectedSchedule(schedule);
        setIsDialogOpen(true);
    };

    const handleRequestDelete = (id: number) => {
        setDeleteTargetId(id);
        setIsDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTargetId) return;
        setIsDeleting(true);
        try {
            const success = await removeSchedule(deleteTargetId);
            if (success) {
                toast.success("Schedule deleted successfully");
            } else {
                toast.error("Failed to delete schedule");
            }
        } finally {
            setIsDeleting(false);
            setIsDeleteOpen(false);
            setDeleteTargetId(null);
        }
    };

    const handleSubmit = async (data: ScheduleFormValues): Promise<boolean> => {
        setIsSaving(true);
        try {
            if (selectedSchedule) {
                const success = await updateSchedule(selectedSchedule.id, data, selectedSchedule);
                if (success) {
                    toast.success("Schedule updated successfully");
                    setIsDialogOpen(false);
                    return true;
                } else {
                    toast.error("Failed to update schedule");
                    return false;
                }
            } else {
                const success = await addSchedule(data);
                if (success) {
                    toast.success("Schedule created successfully");
                    setIsDialogOpen(false);
                    return true;
                } else {
                    toast.error("Failed to create schedule");
                    return false;
                }
            }
        } catch (error) {
            console.error("Submit failed:", error);
            toast.error("An unexpected error occurred");
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleApproveTarget = async (id: number) => {
        const userId = getUserIdFromCookie() || 1;
        const success = await approveTarget(id, userId);
        if (success) {
            toast.success("Daily target approved");
        } else {
            toast.error("Failed to approve target");
        }
    };

    const handleApproveHeadcount = async (posItemId: number) => {
        const userId = getUserIdFromCookie() || 1;
        const success = await approveHeadcount(posItemId, userId);
        if (success) {
            toast.success("Position headcount approved");
        } else {
            toast.error("Failed to approve headcount");
        }
    };

    return {
        schedules,
        lines,
        isLoading,
        refetch,
        isDialogOpen,
        setIsDialogOpen,
        selectedSchedule,
        isSaving,
        isDeleteOpen,
        setIsDeleteOpen,
        isDeleting,
        handleAdd,
        handleEdit,
        handleRequestDelete,
        handleConfirmDelete,
        handleSubmit,
        handleApproveTarget,
        handleApproveHeadcount,
    };
}
