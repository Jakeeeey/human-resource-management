"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Handbook } from "../types";

const API_PATH = "/api/hrm/handbook";

interface HandbookContextType {
    handbooks: Handbook[];
    isLoading: boolean;
    error: string | null;
    isCreateOpen: boolean;
    setIsCreateOpen: (isOpen: boolean) => void;
    isEditOpen: boolean;
    setIsEditOpen: (isOpen: boolean) => void;
    isDetailOpen: boolean;
    setIsDetailOpen: (isOpen: boolean) => void;
    selectedHandbook: Handbook | null;
    setSelectedHandbook: (handbook: Handbook | null) => void;
    refresh: () => Promise<void>;
    submitHandbook: (form: Handbook) => Promise<boolean>;
    updateHandbook: (id: number, data: Partial<Handbook>) => Promise<boolean>;
    deleteHandbook: (id: number) => Promise<boolean>;
}

const HandbookContext = createContext<HandbookContextType | undefined>(undefined);

export function HandbookProvider({ children }: { children: React.ReactNode }) {
    const [handbooks, setHandbooks] = useState<Handbook[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedHandbook, setSelectedHandbook] = useState<Handbook | null>(null);

    const [isEditOpen, setIsEditOpen] = useState(false);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(API_PATH);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to load handbooks");
            }
            const result = await response.json();
            // Since we return data directly from the service or wrapped in data
            const data = Array.isArray(result) ? result : result.data;
            setHandbooks(data as Handbook[]);
        } catch (err) {
            const e = err as Error;
            setError(e.message);
            toast.error(e.message || "Could not load handbooks");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const submitHandbook = useCallback(
        async (form: Handbook): Promise<boolean> => {
            try {
                const response = await fetch(API_PATH, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                });
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || "Failed to submit handbook");
                }
                toast.success("Handbook has been created");
                await refresh();
                return true;
            } catch (err) {
                toast.error((err as Error).message || "Could not create handbook");
                return false;
            }
        },
        [refresh]
    );

    const updateHandbook = useCallback(
        async (id: number, data: Partial<Handbook>): Promise<boolean> => {
            try {
                const response = await fetch(`${API_PATH}/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || "Failed to update handbook");
                }
                toast.success(`Handbook updated`);
                await refresh();
                return true;
            } catch (err) {
                toast.error((err as Error).message || "Could not update handbook");
                return false;
            }
        },
        [refresh]
    );

    const deleteHandbook = useCallback(
        async (id: number): Promise<boolean> => {
            try {
                const response = await fetch(`${API_PATH}/${id}`, { method: "DELETE" });
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || "Failed to delete handbook");
                }
                toast.success("Handbook deleted");
                await refresh();
                return true;
            } catch (err) {
                toast.error((err as Error).message || "Could not delete handbook");
                return false;
            }
        },
        [refresh]
    );

    const contextValue = useMemo(
        () => ({
            handbooks,
            isLoading,
            error,
            isCreateOpen,
            setIsCreateOpen,
            isEditOpen,
            setIsEditOpen,
            isDetailOpen,
            setIsDetailOpen,
            selectedHandbook,
            setSelectedHandbook,
            refresh,
            submitHandbook,
            updateHandbook,
            deleteHandbook,
        }),
        [handbooks, isLoading, error, isCreateOpen, isEditOpen, isDetailOpen, selectedHandbook, refresh, submitHandbook, updateHandbook, deleteHandbook]
    );

    return (
        <HandbookContext.Provider value={contextValue}>
            {children}
        </HandbookContext.Provider>
    );
}

export function useHandbookContext() {
    const context = useContext(HandbookContext);
    if (context === undefined) {
        throw new Error("useHandbookContext must be used within a HandbookProvider");
    }
    return context;
}
