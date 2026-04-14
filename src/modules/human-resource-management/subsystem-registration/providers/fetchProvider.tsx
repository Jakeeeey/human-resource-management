"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { SubsystemRegistration } from "../types";
import { SubsystemService } from "../services/SubsystemService";

interface SubsystemRegistrationFetchContextType {
    subsystems: SubsystemRegistration[];
    isLoading: boolean;
    refetch: () => Promise<void>;
    addResource: (data: Partial<SubsystemRegistration>) => Promise<boolean>;
    updateResource: (id: string, data: Partial<SubsystemRegistration>) => Promise<{ success: boolean; message?: string }>;
    removeResource: (id: string) => Promise<boolean>;
}

const SubsystemRegistrationFetchContext =
    createContext<SubsystemRegistrationFetchContextType | undefined>(undefined);

export function SubsystemRegistrationFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [subsystems, setSubsystems] = useState<SubsystemRegistration[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await SubsystemService.getSubsystems();
            setSubsystems(data);
        } catch (err) {
            console.error("Failed to fetch subsystems", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const addResource = async (data: Partial<SubsystemRegistration>) => {
        const created = await SubsystemService.createSubsystem(data);
        if (created) {
            await fetchData();
            return true;
        }
        return false;
    };

    const updateResource = async (id: string, data: Partial<SubsystemRegistration>) => {
        const result = await SubsystemService.updateSubsystem(id, data);
        if (result.success) {
            await fetchData();
        }
        return result;
    };

    const removeResource = async (id: string) => {
        const success = await SubsystemService.deleteSubsystem(id);
        if (success) {
            await fetchData();
            return true;
        }
        return false;
    };

    return React.createElement(
        SubsystemRegistrationFetchContext.Provider,
        {
            value: {
                subsystems,
                isLoading,
                refetch: fetchData,
                addResource,
                updateResource,
                removeResource,
            },
        },
        children
    );
}

export function useSubsystemRegistrationFetchContext() {
    const ctx = useContext(SubsystemRegistrationFetchContext);
    if (!ctx)
        throw new Error(
            "Must be used inside SubsystemRegistrationFetchProvider"
        );
    return ctx;
}
