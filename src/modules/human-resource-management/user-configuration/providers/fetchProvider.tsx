"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { UserSubsystemAccess } from "../types";
import { UserService } from "../services/UserService";
import { SubsystemService } from "@/modules/human-resource-management/subsystem-registration/services/SubsystemService";
import { SubsystemRegistration } from "@/modules/human-resource-management/subsystem-registration/types";
import { toast } from "sonner";

interface UserConfigurationFetchContextType {
    users: UserSubsystemAccess[];
    subsystems: SubsystemRegistration[];
    isLoading: boolean;
    currentPage: number;
    totalCount: number;
    pageSize: number;
    fetchPage: (page: number) => Promise<void>;
    updateUserPermissions: (userId: string, permissions: string[], subsystemAccessIds: Record<string, number>, moduleAccessIds: Record<string, number>) => void;
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

    const fetchPage = useCallback(async (page: number) => {
        setIsLoading(true);
        try {
            const offset = page * LIMIT;
            
            // 1. Fetch Subsystems and Users in parallel
            const [subsystemData, { users: userData, total }] = await Promise.all([
                SubsystemService.getSubsystems(),
                UserService.getUsers(LIMIT, offset)
            ]);
            
            // 2. Bulk Fetch Permissions for the users on this page (Junction Table IDs & Slugs)
            const userIds = userData.map(u => u.user_id);
            const permissionsMap = await UserService.getPermissionsForUsers(userIds);

            // 3. Merge permissions into user objects
            const mergedUsers = userData.map(user => {
                const p = permissionsMap[user.user_id] || { 
                    subsystemSlugs: [], 
                    moduleSlugs: [], 
                    subsystemAccessIds: {}, 
                    moduleAccessIds: {} 
                };
                
                return {
                    ...user,
                    authorized_subsystems: [...p.subsystemSlugs, ...p.moduleSlugs],
                    subsystemAccessIds: p.subsystemAccessIds,
                    moduleAccessIds: p.moduleAccessIds,
                };
            });

            setSubsystems(subsystemData);
            setUsers(mergedUsers);
            setTotalCount(total);
            setCurrentPage(page);
        } catch (error) {
            console.error("Failed to load configuration data:", error);
            toast.error("Failed to load users or permissions from the database.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPage(0);
    }, [fetchPage]);

    const updateUserPermissions = useCallback((userId: string, permissions: string[], subsystemAccessIds: Record<string, number>, moduleAccessIds: Record<string, number>) => {
        setUsers((current) =>
            current.map((user) => (user.user_id === userId ? { 
                ...user, 
                authorized_subsystems: permissions,
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
                currentPage,
                totalCount,
                pageSize: LIMIT,
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
