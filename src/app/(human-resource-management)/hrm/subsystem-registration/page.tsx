"use client";

import React from "react";
import { SubsystemRegistrationTable } from "@/modules/human-resource-management/subsystem-registration/components/SubsystemRegistrationTable";
import { SubsystemDialog } from "@/modules/human-resource-management/subsystem-registration/components/SubsystemDialog";
import { SubsystemHierarchyDialog } from "@/modules/human-resource-management/subsystem-registration/components/SubsystemHierarchyDialog";
import { SubsystemRegistration } from "@/modules/human-resource-management/subsystem-registration/types";
import { toast } from "sonner";

import { SubsystemService } from "@/modules/human-resource-management/subsystem-registration/services/SubsystemService";

export default function SubsystemRegistrationPage() {
    const [subsystems, setSubsystems] = React.useState<SubsystemRegistration[]>([]);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [isHierarchyOpen, setIsHierarchyOpen] = React.useState(false);
    const [selectedSubsystem, setSelectedSubsystem] = React.useState<SubsystemRegistration | null>(null);
    const [hierarchySubsystem, setHierarchySubsystem] = React.useState<SubsystemRegistration | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const load = async () => {
            const data = await SubsystemService.getSubsystems();
            setSubsystems(data);
            setIsLoading(false);
        };
        load();
    }, []);

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
        const newList = subsystems.map(s => s.id === updated.id ? updated : s);
        setSubsystems(newList);
        await SubsystemService.saveSubsystems(newList);
        toast.success(`Updated hierarchy for ${updated.title}`);
    };

    const handleDelete = async (subsystem: SubsystemRegistration) => {
        if (confirm(`Are you sure you want to delete ${subsystem.title}?`)) {
            const newList = subsystems.filter((s) => s.slug !== subsystem.slug);
            setSubsystems(newList);
            await SubsystemService.saveSubsystems(newList);
            toast.success(`Subsystem ${subsystem.slug} deleted.`);
        }
    };

    const handleSubmit = async (data: Partial<SubsystemRegistration>) => {
        let newList: SubsystemRegistration[];
        if (selectedSubsystem) {
            // Edit
            newList = subsystems.map((s) => (s.slug === selectedSubsystem.slug ? { ...s, ...data } : s)) as SubsystemRegistration[];
            toast.success(`Updated ${data.title}`);
        } else {
            // Add
            const newSubsystem = {
                ...data,
                id: Math.random().toString(36).substr(2, 9),
            } as SubsystemRegistration;
            newList = [...subsystems, newSubsystem];
            toast.success(`Registered ${data.title}`);
        }
        setSubsystems(newList);
        await SubsystemService.saveSubsystems(newList);
    };

    return (
        <div className="flex-1 space-y-4 p-4 pt-6 h-full overflow-auto">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Subsystem Registration</h2>
                    <p className="text-muted-foreground">
                        Register and manage subsystems accessible within the ERP.
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
}
