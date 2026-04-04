"use client";

import { useState, useCallback } from "react";
import { useUserConfigurationFetchContext } from "../providers/fetchProvider";
import { UserSubsystemAccess } from "../types";
import { SubsystemRegistration } from "@/modules/human-resource-management/subsystem-registration/types";
import { UserService } from "../services/UserService";
import { extractAllSlugs } from "../utils/permissionUtils";
import { toast } from "sonner";

export function useUserConfiguration() {
    const { 
        users, 
        subsystems, 
        isLoading, 
        currentPage, 
        totalCount, 
        pageSize, 
        fetchPage,
        updateUserPermissions,
    } = useUserConfigurationFetchContext();
    
    // Permissions Dialog State
    const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
    const [activeUser, setActiveUser] = useState<UserSubsystemAccess | null>(null);
    const [activeSubsystem, setActiveSubsystem] = useState<SubsystemRegistration | null>(null);

    const handleToggleAccess = useCallback(async (userId: string, subsystemId: string, authorized: boolean) => {
        let finalAccess: string[] = [];
        
        // Find the full subsystem object to get its children slugs
        const fullSubsystem = subsystems.find(s => s.slug === subsystemId);
        const slugsToToggle = fullSubsystem ? extractAllSlugs(fullSubsystem) : [subsystemId];

        const user = users.find(u => u.user_id === userId);
        if (!user) return;

        const newAccess = authorized
            ? Array.from(new Set([...user.authorized_subsystems, ...slugsToToggle]))
            : user.authorized_subsystems.filter((id) => !slugsToToggle.includes(id));
        
        finalAccess = newAccess;
        updateUserPermissions(userId, newAccess);

        // Persist change
        const success = await UserService.updatePermissions(userId, finalAccess);
        if (success) {
            toast.success("User access updated successfully");
        } else {
            toast.error("Failed to persist permission changes.");
        }
    }, [subsystems, users, updateUserPermissions]);

    const handleConfigure = useCallback((user: UserSubsystemAccess, subsystem: SubsystemRegistration) => {
        setActiveUser(user);
        setActiveSubsystem(subsystem);
        setIsPermissionsOpen(true);
    }, []);

    const handleUpdatePermissions = useCallback(async (userId: string, items: string[]) => {
        updateUserPermissions(userId, items);
        
        // Persist change
        const success = await UserService.updatePermissions(userId, items);
        if (success) {
            toast.success("Granular permissions updated successfully");
        } else {
            toast.error("Failed to persist granular changes.");
        }
    }, [updateUserPermissions]);

    return {
        users,
        subsystems,
        isLoading,
        currentPage,
        totalCount,
        pageSize,
        isPermissionsOpen,
        setIsPermissionsOpen,
        activeUser,
        activeSubsystem,
        fetchPage,
        handleToggleAccess,
        handleConfigure,
        handleUpdatePermissions,
    };
}
