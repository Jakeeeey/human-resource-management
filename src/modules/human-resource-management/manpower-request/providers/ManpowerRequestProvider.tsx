"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { ManpowerRequest } from "../types";

const API_PATH = "/api/hrm/manpower-request";

interface ManpowerRequestContextType {
    requests: ManpowerRequest[];
    isLoading: boolean;
    error: string | null;
    isCreateOpen: boolean;
    setIsCreateOpen: (isOpen: boolean) => void;
    isEditOpen: boolean;
    setIsEditOpen: (isOpen: boolean) => void;
    selectedRequest: ManpowerRequest | null;
    setSelectedRequest: (request: ManpowerRequest | null) => void;
    isViewOpen: boolean;
    setIsViewOpen: (isOpen: boolean) => void;
    refresh: () => Promise<void>;
    submitRequest: (form: ManpowerRequest) => Promise<boolean>;
    updateRequest: (id: number, data: Partial<ManpowerRequest>) => Promise<boolean>;
    deleteRequest: (id: number) => Promise<boolean>;
    departments: {id: number, name: string}[];
    divisions: {id: number, name: string}[];
}

const ManpowerRequestContext = createContext<ManpowerRequestContextType | undefined>(undefined);

export function ManpowerRequestProvider({ children }: { children: React.ReactNode }) {
    const [requests, setRequests] = useState<ManpowerRequest[]>([]);
    const [departments, setDepartments] = useState<{id: number, name: string}[]>([]);
    const [divisions, setDivisions] = useState<{id: number, name: string}[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<ManpowerRequest | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(API_PATH);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to load requests");
            }
            const result = await response.json();
            setRequests(Array.isArray(result.data) ? result.data : []);
            setDepartments(result.departments || []);
            setDivisions(result.divisions || []);
        } catch (err) {
            const e = err as Error;
            setError(e.message);
            toast.error(e.message || "Could not load requests");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const submitRequest = useCallback(async (form: ManpowerRequest): Promise<boolean> => {
        try {
            const response = await fetch(API_PATH, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to submit request");
            }
            toast.success("Manpower Request created successfully!");
            await refresh();
            return true;
        } catch (err) {
            toast.error((err as Error).message || "Could not create request");
            return false;
        }
    }, [refresh]);

    const updateRequest = useCallback(async (id: number, data: Partial<ManpowerRequest>): Promise<boolean> => {
        try {
            const response = await fetch(`${API_PATH}/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to update request");
            }
            toast.success("Manpower Request updated!");
            await refresh();
            return true;
        } catch (err) {
            toast.error((err as Error).message || "Could not update request");
            return false;
        }
    }, [refresh]);

    const deleteRequest = useCallback(async (id: number): Promise<boolean> => {
        try {
            const response = await fetch(`${API_PATH}/${id}`, { method: "DELETE" });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to delete request");
            }
            toast.success("Manpower Request deleted");
            await refresh();
            return true;
        } catch (err) {
            toast.error((err as Error).message || "Could not delete request");
            return false;
        }
    }, [refresh]);

    const contextValue = useMemo(() => ({
        requests, departments, divisions, isLoading, error, isCreateOpen, setIsCreateOpen, 
        isEditOpen, setIsEditOpen, isViewOpen, setIsViewOpen, selectedRequest, setSelectedRequest,
        refresh, submitRequest, updateRequest, deleteRequest
    }), [requests, departments, divisions, isLoading, error, isCreateOpen, isEditOpen, isViewOpen, selectedRequest, refresh, submitRequest, updateRequest, deleteRequest]);

    return (
        <ManpowerRequestContext.Provider value={contextValue}>
            {children}
        </ManpowerRequestContext.Provider>
    );
}

export function useManpowerRequestContext() {
    const context = useContext(ManpowerRequestContext);
    if (context === undefined) {
        throw new Error("useManpowerRequestContext must be used within a ManpowerRequestProvider");
    }
    return context;
}
