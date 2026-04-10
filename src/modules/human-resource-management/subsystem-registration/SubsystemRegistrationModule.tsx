"use client";

import React from "react";
import { SubsystemRegistrationFetchProvider } from "./providers/fetchProvider";
import { useSubsystemRegistration } from "./hooks/useSubsystemRegistration";
import { SubsystemRegistrationTable } from "./components/SubsystemRegistrationTable";
import { SubsystemDialog } from "./components/SubsystemDialog";
import { SubsystemHierarchyDialog } from "./components/SubsystemHierarchyDialog";

const SubsystemRegistrationContent = () => {
    const {
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
    } = useSubsystemRegistration();

    return (
        <div className="flex-1 space-y-6 p-6 pt-8 h-full overflow-auto bg-gradient-to-br from-background via-background to-primary/[0.02]">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black tracking-tighter text-foreground leading-tight">Subsystem Registration</h2>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">
                        Enterprise Architecture Node Registry
                    </p>
                </div>
            </div>

            <SubsystemRegistrationTable
                data={subsystems}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onManageHierarchy={handleManageHierarchy}
                isLoading={isLoading}
            />

            <SubsystemDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSubmit={handleSubmit}
                subsystem={selectedSubsystem}
            />

            <SubsystemHierarchyDialog
                open={isHierarchyOpen}
                onOpenChange={setIsHierarchyOpen}
                subsystem={hierarchySubsystem}
                onUpdate={handleUpdateHierarchy}
            />
        </div>
    );
};

export const SubsystemRegistrationModule = () => {
    return (
        <SubsystemRegistrationFetchProvider>
            <SubsystemRegistrationContent />
        </SubsystemRegistrationFetchProvider>
    );
};
