/* eslint-disable */
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
        const parsed = parseInt(userId, 10);
        return isNaN(parsed) ? null : parsed;
    } catch {
        return null;
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
    } = useSchedulingFetchContext();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState<ProductionSchedule | null>(null);

    // Delete dialog
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [scheduleToDelete, setScheduleToDelete] = useState<ProductionSchedule | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Save loading state
    const [isSaving, setIsSaving] = useState(false);

    // Attachments dialog
    const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);
    const [attachmentsSchedule, setAttachmentsSchedule] = useState<ProductionSchedule | null>(null);

    const handleAdd = () => {
        setSelectedSchedule(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (schedule: ProductionSchedule) => {
        setSelectedSchedule(schedule);
        setIsDialogOpen(true);
    };

    const handleRequestDelete = (schedule: ProductionSchedule) => {
        setScheduleToDelete(schedule);
        setIsDeleteOpen(true);
    };

    const handleAttachments = (schedule: ProductionSchedule) => {
        setAttachmentsSchedule(schedule);
        setIsAttachmentsOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (scheduleToDelete) {
            setIsDeleting(true);
            try {
                const userId = getUserIdFromCookie();
                const success = await removeSchedule(scheduleToDelete.id, userId);
                if (success) {
                    toast.success("Schedule deleted successfully");
                    setIsDeleteOpen(false);
                    setScheduleToDelete(null);
                } else {
                    toast.error("Failed to delete schedule");
                }
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const handleSubmit = async (data: ScheduleFormValues): Promise<boolean> => {
        setIsSaving(true);
        const userId = getUserIdFromCookie();
        try {
            if (selectedSchedule) {
                const success = await updateSchedule(selectedSchedule.id, data, selectedSchedule, userId);
                if (success) {
                    toast.success("Schedule updated successfully");
                    setIsDialogOpen(false);
                    return true;
                } else {
                    toast.error("Failed to update schedule");
                    return false;
                }
            } else {
                const success = await addSchedule(data, userId);
                if (success) {
                    toast.success("Schedule created successfully");
                    setIsDialogOpen(false);
                    return true;
                } else {
                    toast.error("Failed to create schedule");
                    return false;
                }
            }
        } catch (error: any) {
            toast.error(error.message || "An unexpected error occurred");
            return false;
        } finally {
            setIsSaving(false);
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
        isAttachmentsOpen,
        setIsAttachmentsOpen,
        attachmentsSchedule,
        handleAdd,
        handleEdit,
        handleRequestDelete,
        handleAttachments,
        handleConfirmDelete,
        handleSubmit,
    };
}
