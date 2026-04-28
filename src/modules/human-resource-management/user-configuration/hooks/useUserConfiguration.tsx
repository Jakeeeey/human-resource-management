"use client";

import { useState, useCallback } from "react";
import { useUserConfigurationFetchContext } from "../providers/fetchProvider";
import { UserSubsystemAccess } from "../types";
import { SubsystemRegistration, ModuleRegistration } from "@/modules/human-resource-management/subsystem-registration/types";
import { UserService } from "../services/UserService";
import { extractAllSlugs, extractAllIds } from "../utils/permissionUtils";
import { toast } from "sonner";
import { APP_SIDEBAR_REFRESH_EVENT } from "@/components/shared/app-sidebar/app-sidebar-events";

export function useUserConfiguration() {
    const { 
        users, 
        subsystems, 
        isLoading, 
        currentPage, 
        totalCount, 
        pageSize, 
        searchTerm,
        fetchPage,
        updateUserPermissions,
    } = useUserConfigurationFetchContext();
    
    // Permissions Dialog State
    const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
    const [activeUser, setActiveUser] = useState<UserSubsystemAccess | null>(null);
    const [activeSubsystem, setActiveSubsystem] = useState<SubsystemRegistration | null>(null);

    // const { userId: currentAdminId, updatePermissionsRemotely } = usePermissionsStore();

    /**
     * Toggles access for an entire subsystem.
     * MANUAL-ADD Model: Turning ON only adds the subsystem.
     * AUTO-CLEANUP Model: Turning OFF removes the subsystem AND all its module permissions.
     */
    const handleToggleAccess = useCallback(async (userId: string, subsystemId: string | number, authorized: boolean) => {
        const user = users.find(u => u.user_id === userId);
        const subRegistry = subsystems.find(s => Number(s.id) === Number(subsystemId));
        if (!user || !subRegistry) return;

        const subSlug = subRegistry.slug;
        const slugsInSubsystem = extractAllSlugs(subRegistry);
        const subPk = Number(subRegistry.id);

        // DEEP FIX: Collect module IDs exclusively from the module tree of this subsystem
        const allModuleIds: number[] = [];
        subRegistry.modules?.forEach(mod => {
            allModuleIds.push(...extractAllIds(mod));
        });

        const newSlugs = authorized
            ? Array.from(new Set([...user.authorized_subsystems, subSlug]))
            : user.authorized_subsystems.filter((slug) => !slugsInSubsystem.includes(slug));
        
        const newSubIds = authorized
            ? Array.from(new Set([...(user.authorized_subsystem_ids || []), subPk]))
            : (user.authorized_subsystem_ids || []).filter(id => id !== subPk);

        // Modules only change on Toggle OFF (Auto-Cleanup)
        const newModuleIds = authorized
            ? (user.authorized_module_ids || [])
            : (user.authorized_module_ids || []).filter(id => !allModuleIds.includes(id));

        const updates = {
            subsystemsToAdd: authorized ? [subPk] : [],
            subsystemsToRemove: (!authorized && user.subsystemAccessIds[subPk]) ? [user.subsystemAccessIds[subPk]] : [],
            modulesToAdd: [] as number[],
            modulesToRemove: (!authorized) 
                ? allModuleIds.filter(id => user.moduleAccessIds[id]).map(id => user.moduleAccessIds[id]) 
                : []
        };

        // Optimistic UI Update
        updateUserPermissions(userId, newSlugs, newSubIds, newModuleIds, user.subsystemAccessIds, user.moduleAccessIds);

        const success = await UserService.updatePermissions(userId, null, updates);
        if (success) {
            toast.success("User access updated successfully");
            fetchPage(currentPage, true);
            
            // Trigger Sidebar Refresh
            window.dispatchEvent(new CustomEvent(APP_SIDEBAR_REFRESH_EVENT));
        } else {
            toast.error("Failed to persist permission changes.");
            fetchPage(currentPage, true);
        }
    }, [subsystems, users, updateUserPermissions, fetchPage, currentPage]);

    const handleConfigure = useCallback((user: UserSubsystemAccess, subsystem: SubsystemRegistration) => {
        setActiveUser(user);
        setActiveSubsystem(subsystem);
        setIsPermissionsOpen(true);
    }, []);

    /**
     * Updates granular module permissions using Database IDs.
     * Separates subsystem IDs from module IDs to avoid collisions.
     */
    const handleUpdatePermissions = useCallback(async (userId: string, newSubIds: number[], newModuleIds: number[]) => {
        const user = users.find(u => u.user_id === userId);
        if (!user || !activeSubsystem) return;

        const currentSubIds = user.authorized_subsystem_ids || [];
        const currentModuleIds = user.authorized_module_ids || [];
        const activeSubPk = Number(activeSubsystem.id);

        // Diff Calculation
        const subAdded = newSubIds.filter(id => !currentSubIds.includes(id));
        const subRemoved = currentSubIds.filter(id => !newSubIds.includes(id));
        const modAdded = newModuleIds.filter(id => !currentModuleIds.includes(id));
        const modRemoved = currentModuleIds.filter(id => !newModuleIds.includes(id));

        const updates = {
            subsystemsToAdd: subAdded,
            subsystemsToRemove: subRemoved.map(id => user.subsystemAccessIds[id]).filter(Boolean) as number[],
            modulesToAdd: modAdded,
            modulesToRemove: modRemoved.map(id => user.moduleAccessIds[id]).filter(Boolean) as number[]
        };

        // Sync Slugs for UI/Routing
        const allSlugsInActiveSub = extractAllSlugs(activeSubsystem);
        const findSlugById = (id: number, modules: ModuleRegistration[]): string | null => {
            for (const m of modules) {
                if (Number(m.id) === id) return m.slug;
                if (m.subModules) {
                    const found = findSlugById(id, m.subModules);
                    if (found) return found;
                }
            }
            return null;
        };

        const activeModSlugs = newModuleIds
            .map(id => findSlugById(id, activeSubsystem.modules || []))
            .filter(Boolean) as string[];

        const activeSubSlug = newSubIds.includes(activeSubPk) ? [activeSubsystem.slug] : [];

        const newSlugs = Array.from(new Set([
            ...user.authorized_subsystems.filter(s => !allSlugsInActiveSub.includes(s)),
            ...activeSubSlug,
            ...activeModSlugs
        ]));

        // Optimistic UI Update
        updateUserPermissions(userId, newSlugs, newSubIds, newModuleIds, user.subsystemAccessIds, user.moduleAccessIds);

        const success = await UserService.updatePermissions(userId, null, updates);
        if (success) {
            toast.success("Granular permissions updated successfully");
            fetchPage(currentPage, true);
            
            // Trigger Sidebar Refresh via Custom Event
            window.dispatchEvent(new CustomEvent(APP_SIDEBAR_REFRESH_EVENT));
        } else {
            toast.error("Failed to persist granular changes.");
            fetchPage(currentPage, true);
        }
    }, [users, activeSubsystem, updateUserPermissions, fetchPage, currentPage]);

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
        searchTerm,
        fetchPage,
        handleToggleAccess,
        handleConfigure,
        handleUpdatePermissions,
    };
}
