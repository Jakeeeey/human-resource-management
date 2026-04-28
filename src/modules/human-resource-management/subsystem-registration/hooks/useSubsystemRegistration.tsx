"use client";

import { useState } from "react";
import { useSubsystemRegistrationFetchContext } from "../providers/fetchProvider";
import { SubsystemRegistration } from "../types";
import { toast } from "sonner";

export function useSubsystemRegistration() {
    const { subsystems, isLoading, addResource, updateResource, removeResource } = useSubsystemRegistrationFetchContext();
    
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isHierarchyOpen, setIsHierarchyOpen] = useState(false);
    const [selectedSubsystem, setSelectedSubsystem] = useState<SubsystemRegistration | null>(null);
    const [hierarchySubsystem, setHierarchySubsystem] = useState<SubsystemRegistration | null>(null);

    const handleAdd = () => {
        setSelectedSubsystem(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (subsystem: SubsystemRegistration) => {
        setSelectedSubsystem(subsystem);
        setIsDialogOpen(true);
    };

    const handleManageHierarchy = (subsystem: SubsystemRegistration) => {
        setHierarchySubsystem(subsystem);
        setIsHierarchyOpen(true);
    };

    const handleUpdateHierarchy = async (updated: SubsystemRegistration) => {
        const result = await updateResource(String(updated.id), updated);
        if (result.success) {
            setHierarchySubsystem(updated); 
            toast.success(`Updated hierarchy for ${updated.title}`);
            return { success: true };
        } else {
            toast.error(result.message || "Failed to update hierarchy");
            return result;
        }
    };

    const handleDelete = async (subsystem: SubsystemRegistration) => {
        if (confirm(`Are you sure you want to delete ${subsystem.title}?`)) {
            const success = await removeResource(String(subsystem.id));
            if (success) {
                toast.success(`Subsystem ${subsystem.title} deleted.`);
            } else {
                toast.error("Failed to delete subsystem");
            }
        }
    };

    const handleSubmit = async (data: Partial<SubsystemRegistration>) => {
        if (selectedSubsystem) {
            // Edit
            const result = await updateResource(String(selectedSubsystem.id), data);
            if (result.success) {
                toast.success(`Updated ${data.title}`);
                return true;
            } else {
                toast.error(result.message || `Failed to update ${data.title}`);
                return false;
            }
        } else {
            // Add
            const success = await addResource(data);
            if (success) {
                toast.success(`Registered ${data.title}`);
                return true;
            } else {
                toast.error(`Failed to register ${data.title}`);
                return false;
            }
        }
    };

    return {
        subsystems,
        isLoading,
        isDialogOpen,
        setIsDialogOpen,
        isHierarchyOpen,
        setIsHierarchyOpen,
        selectedSubsystem,
        hierarchySubsystem,
        handleAdd,
        handleEdit,
        handleDelete,
        handleManageHierarchy,
        handleUpdateHierarchy,
        handleSubmit,
    };
}
