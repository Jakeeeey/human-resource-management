"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { UserSubsystemAccess } from "../types";
import { UserService } from "../services/UserService";
import { SubsystemRegistration } from "@/modules/human-resource-management/subsystem-registration/types";
import { toast } from "sonner";

interface UserConfigurationFetchContextType {
    users: UserSubsystemAccess[];
    subsystems: SubsystemRegistration[];
    isLoading: boolean;
    isFirstLoad: boolean;
    currentPage: number;
    totalCount: number;
    pageSize: number;
    searchTerm: string;
    fetchPage: (page: number, quiet?: boolean, search?: string) => Promise<void>;
    updateUserPermissions: (
        userId: string, 
        permissions: string[], 
        authorizedSubsystemIds: number[],
        authorizedModuleIds: number[],
        subsystemAccessIds: Record<number, number>, 
        moduleAccessIds: Record<number, number>
    ) => void;
}

const UserConfigurationFetchContext =
    createContext<UserConfigurationFetchContextType | undefined>(undefined);

export const LIMIT = 50;

export function UserConfigurationFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [users, setUsers] = useState<UserSubsystemAccess[]>([]);
    const [subsystems, setSubsystems] = useState<SubsystemRegistration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    const fetchPage = useCallback(async (page: number, quiet = false, search?: string) => {
        // Only show global loading if it's the first time or not quiet
        const shouldShowLoading = isFirstLoad || !quiet;
        if (shouldShowLoading) setIsLoading(true);
        else if (quiet) setIsLoading(true); 
        
        try {
            const activeSearch = search !== undefined ? search : searchTerm;
            const offset = page * LIMIT;
            
            // 1. Fetch Subsystems (Cached) and Users in parallel
            // Note: UserService.getSubsystemsRegistry() now handles its own internal caching
            const [subsystemData, { users: userData, total }] = await Promise.all([
                UserService.getSubsystemsRegistry(),
                UserService.getUsers(LIMIT, offset, activeSearch)
            ]);

            if (search !== undefined) setSearchTerm(search);
            
            // 2. Immediate Return if no users
            if (userData.length === 0) {
                setSubsystems(subsystemData);
                setUsers([]);
                setTotalCount(0);
                setCurrentPage(page);
                setIsFirstLoad(false);
                return;
            }

            // 3. Bulk Fetch Permissions
            const userIds = userData.map(u => u.user_id);
            const permissionsMap = await UserService.getPermissionsForUsers(userIds);

            // 4. Merge permissions
            const mergedUsers = userData.map(user => {
                const p = permissionsMap[user.user_id] || { 
                    subsystemSlugs: [], 
                    moduleSlugs: [], 
                    subsystemIds: [],
                    moduleIds: [],
                    subsystemAccessIds: {}, 
                    moduleAccessIds: {} 
                };
                
                return {
                    ...user,
                    authorized_subsystems: [...p.subsystemSlugs, ...p.moduleSlugs],
                    authorized_subsystem_ids: p.subsystemIds,
                    authorized_module_ids: p.moduleIds,
                    subsystemAccessIds: p.subsystemAccessIds,
                    moduleAccessIds: p.moduleAccessIds,
                };
            });

            setSubsystems(subsystemData);
            setUsers(mergedUsers);
            setTotalCount(total);
            setCurrentPage(page);
            setIsFirstLoad(false);
        } catch (error) {
            console.error("Failed to load configuration data:", error);
            toast.error("Failed to load users or permissions from the database.");
        } finally {
            setIsLoading(false);
        }
    }, [isFirstLoad, searchTerm]);

    useEffect(() => {
        fetchPage(0);
    }, [fetchPage]);

    const updateUserPermissions = useCallback((
        userId: string, 
        permissions: string[], 
        authorizedSubsystemIds: number[],
        authorizedModuleIds: number[],
        subsystemAccessIds: Record<number, number>, 
        moduleAccessIds: Record<number, number>
    ) => {
        setUsers((current) =>
            current.map((user) => (user.user_id === userId ? { 
                ...user, 
                authorized_subsystems: permissions,
                authorized_subsystem_ids: authorizedSubsystemIds,
                authorized_module_ids: authorizedModuleIds,
                subsystemAccessIds,
                moduleAccessIds
            } : user))
        );
    }, []);

    return React.createElement(
        UserConfigurationFetchContext.Provider,
        {
            value: {
                users,
                subsystems,
                isLoading,
                isFirstLoad,
                currentPage,
                totalCount,
                pageSize: LIMIT,
                searchTerm,
                fetchPage,
                updateUserPermissions,
            },
        },
        children
    );
}

export function useUserConfigurationFetchContext() {
    const ctx = useContext(UserConfigurationFetchContext);
    if (!ctx)
        throw new Error(
            "Must be used inside UserConfigurationFetchProvider"
        );
    return ctx;
}
