"use client";

import { useState } from "react";
import { useEmployeeConcernContext } from "../providers/EmployeeConcernProvider";
import { EnrichedEmployeeConcern, EmployeeConcernForm, ConcernStatus } from "../types/employee-concern.schema";
import { toast } from "sonner";

/**
 * useEmployeeConcern
 * Consumer of EmployeeConcernContext that adds UI orchestration state:
 * dialog open flags, the currently selected concern, and action handlers.
 */
export function useEmployeeConcern() {
    const { concerns, isLoading, error, refresh, submitConcern, updateStatus, deleteConcern } =
        useEmployeeConcernContext();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedConcern, setSelectedConcern] = useState<EnrichedEmployeeConcern | null>(null);
    const [statusFilter, setStatusFilter] = useState<ConcernStatus | "ALL">("ALL");

    const handleAdd = () => {
        setSelectedConcern(null);
        setIsDialogOpen(true);
    };

    const handleView = (concern: EnrichedEmployeeConcern) => {
        setSelectedConcern(concern);
        setIsDetailOpen(true);
    };

    const handleSubmit = async (form: EmployeeConcernForm): Promise<boolean> => {
        const ok = await submitConcern(form);
        if (ok) {
            setIsDialogOpen(false);
            toast.success("Concern submitted");
        }
        return ok;
    };

    const handleStatusUpdate = async (id: number, status: ConcernStatus): Promise<boolean> => {
        const ok = await updateStatus(id, status);
        if (ok && selectedConcern?.id === id) {
            setSelectedConcern({ ...selectedConcern, status });
        }
        return ok;
    };

    const handleDelete = async (concern: EnrichedEmployeeConcern): Promise<void> => {
        if (!concern.id) return;
        if (confirm(`Delete this concern "${concern.subject_of_concern}"? This cannot be undone.`)) {
            const ok = await deleteConcern(concern.id);
            if (ok && selectedConcern?.id === concern.id) {
                setIsDetailOpen(false);
                setSelectedConcern(null);
            }
        }
    };

    return {
        concerns,
        isLoading,
        error,
        refresh,
        isDialogOpen,
        setIsDialogOpen,
        isDetailOpen,
        setIsDetailOpen,
        selectedConcern,
        statusFilter,
        setStatusFilter,
        handleAdd,
        handleView,
        handleSubmit,
        handleStatusUpdate,
        handleDelete,
    };
}
