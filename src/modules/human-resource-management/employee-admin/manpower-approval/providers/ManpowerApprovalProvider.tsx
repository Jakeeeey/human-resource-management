"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { ManpowerRequest } from "../types";

const API_PATH = "/api/hrm/manpower-approval";

interface ManpowerApprovalContextType {
    requests: ManpowerRequest[];
    isLoading: boolean;
    error: string | null;
    selectedRequest: ManpowerRequest | null;
    setSelectedRequest: (request: ManpowerRequest | null) => void;
    isViewOpen: boolean;
    setIsViewOpen: (isOpen: boolean) => void;
    refresh: () => Promise<void>;
    approveRequest: (id: number) => Promise<boolean>;
    rejectRequest: (id: number) => Promise<boolean>;
    departments: {id: number, name: string}[];
    divisions: {id: number, name: string}[];
    users: {id: number | string, name: string}[];
}

const ManpowerApprovalContext = createContext<ManpowerApprovalContextType | undefined>(undefined);

export function ManpowerApprovalProvider({ children }: { children: React.ReactNode }) {
    const [requests, setRequests] = useState<ManpowerRequest[]>([]);
    const [departments, setDepartments] = useState<{id: number, name: string}[]>([]);
    const [divisions, setDivisions] = useState<{id: number, name: string}[]>([]);
    const [users, setUsers] = useState<{id: number | string, name: string}[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<ManpowerRequest | null>(null);
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
            setUsers(result.users || []);
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

    const handleStatusUpdate = async (id: number, status: 'Approved' | 'Rejected') => {
        try {
            const response = await fetch(API_PATH, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `Failed to ${status.toLowerCase()} request`);
            }

            toast.success(`Request ${status} successfully`);
            setRequests(prev => prev.filter(r => r.id !== id));
            if (selectedRequest?.id === id) {
                setIsViewOpen(false);
                setSelectedRequest(null);
            }
            return true;
        } catch (err) {
            const e = err as Error;
            toast.error(e.message);
            return false;
        }
    };

    const approveRequest = async (id: number) => handleStatusUpdate(id, 'Approved');
    const rejectRequest = async (id: number) => handleStatusUpdate(id, 'Rejected');

    const contextValue = useMemo(() => ({
        requests, departments, divisions, users, isLoading, error,
        isViewOpen, setIsViewOpen, selectedRequest, setSelectedRequest,
        refresh, approveRequest, rejectRequest
    }), [requests, departments, divisions, users, isLoading, error, isViewOpen, selectedRequest, refresh, approveRequest, rejectRequest]);

    return (
        <ManpowerApprovalContext.Provider value={contextValue}>
            {children}
        </ManpowerApprovalContext.Provider>
    );
}

export function useManpowerApprovalContext() {
    const context = useContext(ManpowerApprovalContext);
    if (context === undefined) {
        throw new Error("useManpowerApprovalContext must be used within a ManpowerApprovalProvider");
    }
    return context;
}
