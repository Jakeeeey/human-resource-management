"use client";

import { useState, useCallback } from "react";
import { useUserConfigurationFetchContext } from "../providers/fetchProvider";
import { UserSubsystemAccess } from "../types";
import { SubsystemRegistration } from "@/modules/human-resource-management/subsystem-registration/types";
import { UserService } from "../services/UserService";
import { extractAllSlugs } from "../utils/permissionUtils";
import { toast } from "sonner";
import { usePermissionsStore } from "@/stores/usePermissionsStore";

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

    const { userId: currentAdminId, updatePermissionsRemotely } = usePermissionsStore();

    const handleToggleAccess = useCallback(async (userId: string, subsystemId: string, authorized: boolean) => {
        const user = users.find(u => u.user_id === userId);
        const subRegistry = subsystems.find(s => s.slug === subsystemId);
        if (!user || !subRegistry) return;

        const slugsToToggle = extractAllSlugs(subRegistry);
        const newSlugs = authorized
            ? Array.from(new Set([...user.authorized_subsystems, ...slugsToToggle]))
            : user.authorized_subsystems.filter((slug) => !slugsToToggle.includes(slug));
        
        // Prepare DIFF for persistence
        const updates = {
            subsystemsToAdd: [] as number[],
            subsystemsToRemove: [] as number[],
            modulesToAdd: [] as number[],
            modulesToRemove: [] as number[]
        };

        if (authorized) {
            // Addition: We need registry IDs
            updates.subsystemsToAdd = [Number(subRegistry.id)];
            updates.modulesToAdd = (subRegistry.modules || []).flatMap(m => extractAllSlugs(m))
                .filter(slug => !user.authorized_subsystems.includes(slug))
                .map(slug => {
                    // Find module ID by slug in registry
                    const findIn = (modules: any[]): any => {
                        for (const m of modules) {
                            if (m.slug === slug) return m;
                            if (m.subModules) {
                                const found = findIn(m.subModules);
                                if (found) return found;
                            }
                        }
                    };
                    return Number(findIn(subRegistry.modules)?.id);
                }).filter(id => !isNaN(id));
        } else {
            // Removal: We need junction record IDs from user object
            if (user.subsystemAccessIds[subsystemId]) {
                updates.subsystemsToRemove = [user.subsystemAccessIds[subsystemId]];
            }
            updates.modulesToRemove = slugsToToggle
                .filter(slug => slug !== subsystemId && user.moduleAccessIds[slug])
                .map(slug => user.moduleAccessIds[slug]);
        }

        // Optimistic UI Update (Simplified for now - re-fetch will populate correct junction IDs)
        updateUserPermissions(userId, newSlugs, user.subsystemAccessIds, user.moduleAccessIds);

        // Persist change
        const success = await UserService.updatePermissions(userId, null, updates);
        if (success) {
            toast.success("User access updated successfully");
            fetchPage(currentPage); // Re-fetch to get new junction IDs
            if (userId === currentAdminId) {
                updatePermissionsRemotely(newSlugs);
            }
        } else {
            toast.error("Failed to persist permission changes.");
        }
    }, [subsystems, users, updateUserPermissions, fetchPage, currentPage, currentAdminId, updatePermissionsRemotely]);

    const handleConfigure = useCallback((user: UserSubsystemAccess, subsystem: SubsystemRegistration) => {
        setActiveUser(user);
        setActiveSubsystem(subsystem);
        setIsPermissionsOpen(true);
    }, []);

    const handleUpdatePermissions = useCallback(async (userId: string, newSlugs: string[]) => {
        const user = users.find(u => u.user_id === userId);
        if (!user || !activeSubsystem) return;

        // Calculate Diff similar to handleToggleAccess but at modular level
        const currentSlugs = user.authorized_subsystems;
        const added = newSlugs.filter(s => !currentSlugs.includes(s));
        const removed = currentSlugs.filter(s => !newSlugs.includes(s));

        const updates = {
            subsystemsToAdd: [] as number[],
            subsystemsToRemove: [] as number[],
            modulesToAdd: [] as number[],
            modulesToRemove: [] as number[]
        };

        // Addition
        added.forEach(slug => {
            if (slug === activeSubsystem.slug) {
                updates.subsystemsToAdd.push(Number(activeSubsystem.id));
            } else {
                const findIn = (modules: any[]): any => {
                    for (const m of modules) {
                        if (m.slug === slug) return m;
                        if (m.subModules) {
                            const found = findIn(m.subModules);
                            if (found) return found;
                        }
                    }
                };
                const reg = findIn(activeSubsystem.modules);
                if (reg) updates.modulesToAdd.push(Number(reg.id));
            }
        });

        // Removal
        removed.forEach(slug => {
            if (slug === activeSubsystem.slug && user.subsystemAccessIds[slug]) {
                updates.subsystemsToRemove.push(user.subsystemAccessIds[slug]);
            } else if (user.moduleAccessIds[slug]) {
                updates.modulesToRemove.push(user.moduleAccessIds[slug]);
            }
        });

        updateUserPermissions(userId, newSlugs, user.subsystemAccessIds, user.moduleAccessIds);
        
        const success = await UserService.updatePermissions(userId, null, updates);
        if (success) {
            toast.success("Granular permissions updated successfully");
            fetchPage(currentPage);
            if (userId === currentAdminId) {
                updatePermissionsRemotely(newSlugs);
            }
        } else {
            toast.error("Failed to persist granular changes.");
        }
    }, [users, activeSubsystem, updateUserPermissions, fetchPage, currentPage, currentAdminId, updatePermissionsRemotely]);

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
