"use client";

import React from "react";
import { UserConfigurationTable } from "@/modules/human-resource-management/user-configuration/components/UserConfigurationTable";
import { UserSubsystemAccess } from "@/modules/human-resource-management/user-configuration/types";
import { PermissionsDialog } from "@/modules/human-resource-management/user-configuration/components/PermissionsDialog";
import { toast } from "sonner";

const MOCK_USERS: UserSubsystemAccess[] = [
    {
        user_id: "1",
        email: "admin@vertex.com",
        full_name: "System Admin",
        authorized_subsystems: ["hr", "scm", "finance", "crm", "mfg", "pm", "arf", "comms", "pm-monitoring", "bia"],
    },
    {
        user_id: "2",
        email: "jake@vertex.com",
        full_name: "Jake Staff",
        authorized_subsystems: ["hr", "comms"],
    },
    {
        user_id: "3",
        email: "finance_user@vertex.com",
        full_name: "Finance Manager",
        authorized_subsystems: ["finance"],
    },
];

import { SubsystemService } from "@/modules/human-resource-management/subsystem-registration/services/SubsystemService";
import { SubsystemRegistration } from "@/modules/human-resource-management/subsystem-registration/types";

export default function UserConfigurationPage() {
    const [users, setUsers] = React.useState<UserSubsystemAccess[]>(MOCK_USERS);
    const [subsystems, setSubsystems] = React.useState<SubsystemRegistration[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    
    // Permissions Dialog State
    const [isPermissionsOpen, setIsPermissionsOpen] = React.useState(false);
    const [activeUser, setActiveUser] = React.useState<UserSubsystemAccess | null>(null);
    const [activeSubsystem, setActiveSubsystem] = React.useState<SubsystemRegistration | null>(null);

    React.useEffect(() => {
        const load = async () => {
            const data = await SubsystemService.getSubsystems();
            setSubsystems(data);
            setIsLoading(false);
        };
        load();
    }, []);

    const handleToggleAccess = async (userId: string, subsystemId: string, authorized: boolean) => {
        setUsers((current) =>
            current.map((user) => {
                if (user.user_id === userId) {
                    const newAccess = authorized
                        ? [...user.authorized_subsystems, subsystemId]
                        : user.authorized_subsystems.filter((id) => id !== subsystemId);
                    return { ...user, authorized_subsystems: newAccess };
                }
                return user;
            })
        );
        toast.success(`Updated access for user ${userId}`);
    };

    const handleConfigure = (user: UserSubsystemAccess, subsystem: SubsystemRegistration) => {
        setActiveUser(user);
        setActiveSubsystem(subsystem);
        setIsPermissionsOpen(true);
    };

    const handleUpdatePermissions = (userId: string, items: string[]) => {
        setUsers((current) =>
            current.map((user) => (user.user_id === userId ? { ...user, authorized_subsystems: items } : user))
        );
        toast.success("Permissions updated successfully");
    };

    return (
        <div className="flex-1 space-y-4 p-4 pt-6 h-full overflow-auto">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">User Configuration</h2>
                    <p className="text-muted-foreground">
                        Manage subsystem access permissions for each user.
                    </p>
                </div>
            </div>

            <UserConfigurationTable
                data={users}
                subsystems={subsystems}
                onToggleAccess={handleToggleAccess}
                onConfigure={handleConfigure}
                isLoading={isLoading}
            />

            <PermissionsDialog
                open={isPermissionsOpen}
                onOpenChange={setIsPermissionsOpen}
                user={activeUser}
                subsystem={activeSubsystem}
                authorizedItems={activeUser?.authorized_subsystems || []}
                onUpdate={handleUpdatePermissions}
            />
        </div>
    );
}
