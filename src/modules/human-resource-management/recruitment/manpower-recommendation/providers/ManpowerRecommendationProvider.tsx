"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { ManpowerRecommendation, ManpowerRecommendationCreateInput } from "../types";
import { Interview } from "../../interviews/types";

const API_PATH = "/api/hrm/manpower-recommendation";

interface ManpowerRecommendationContextType {
    recommendations: ManpowerRecommendation[];
    applicants: { id: number; full_name: string; position_applied_for: string }[];
    openRequests: { id: number; request_no: string; division_id: number | null; position: string; no_manpower_needed: number; status: string }[];
    divisions: { id: number; name: string }[];
    users: { id: number | string; name: string }[];
    interviews: Interview[];
    interviewInitialRows: { id: number; applicant_id: number; latestInitialVerdict: string | null }[];
    isLoading: boolean;
    error: string | null;
    isCreateOpen: boolean;
    setIsCreateOpen: (isOpen: boolean) => void;
    selectedRecommendation: ManpowerRecommendation | null;
    setSelectedRecommendation: (recommendation: ManpowerRecommendation | null) => void;
    isViewOpen: boolean;
    setIsViewOpen: (isOpen: boolean) => void;
    pendingRequestId: number | null;
    setPendingRequestId: (id: number | null) => void;
    openRecommendForm: (requestId: number) => void;
    selectedRequest: { id: number; request_no: string; division_id: number | null; position: string; no_manpower_needed: number; status: string } | null;
    setSelectedRequest: (request: { id: number; request_no: string; division_id: number | null; position: string; no_manpower_needed: number; status: string } | null) => void;
    isDetailOpen: boolean;
    setIsDetailOpen: (isOpen: boolean) => void;
    refresh: () => Promise<void>;
    submitRecommendation: (data: ManpowerRecommendationCreateInput) => Promise<boolean>;
    updateRecommendation: (id: number, data: Partial<ManpowerRecommendation>) => Promise<boolean>;
    deleteRecommendation: (id: number) => Promise<boolean>;
}

const ManpowerRecommendationContext = createContext<ManpowerRecommendationContextType | undefined>(undefined);

/**
 * Client-side provider for manpower recommendations.
 * Fetches the Task 4 GET envelope ({ data, applicants, openRequests })
 * and exposes list state plus create/view dialog state and mutations.
 */
export function ManpowerRecommendationProvider({ children }: { children: React.ReactNode }) {
    const [recommendations, setRecommendations] = useState<ManpowerRecommendation[]>([]);
    const [applicants, setApplicants] = useState<{ id: number; full_name: string; position_applied_for: string }[]>([]);
    const [openRequests, setOpenRequests] = useState<{ id: number; request_no: string; division_id: number | null; position: string; no_manpower_needed: number; status: string }[]>([]);
    const [divisions, setDivisions] = useState<{ id: number; name: string }[]>([]);
    const [users, setUsers] = useState<{ id: number | string; name: string }[]>([]);
    const [interviews, setInterviews] = useState<Interview[]>([]);
    const [interviewInitialRows, setInterviewInitialRows] = useState<{ id: number; applicant_id: number; latestInitialVerdict: string | null }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedRecommendation, setSelectedRecommendation] = useState<ManpowerRecommendation | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [pendingRequestId, setPendingRequestId] = useState<number | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<{ id: number; request_no: string; division_id: number | null; position: string; no_manpower_needed: number; status: string } | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    /**
     * Opens the create form pre-armed with a manpower request id.
     * Sets pendingRequestId and flips the create dialog open.
     */
    const openRecommendForm = useCallback((requestId: number) => {
        setPendingRequestId(requestId);
        setIsCreateOpen(true);
    }, []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(API_PATH);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to load recommendations");
            }
            const result = await response.json();
            setRecommendations(Array.isArray(result.data) ? result.data : []);
            setApplicants(Array.isArray(result.applicants) ? result.applicants : []);
            setOpenRequests(Array.isArray(result.openRequests) ? result.openRequests : []);
            setDivisions(Array.isArray(result.divisions) ? result.divisions : []);
            setUsers(Array.isArray(result.users) ? result.users : []);
            try {
                const interviewResponse = await fetch("/api/hrm/interviews");
                if (interviewResponse.ok) {
                    const interviewResult = await interviewResponse.json();
                    setInterviews(Array.isArray(interviewResult.data) ? interviewResult.data : []);
                    setInterviewInitialRows(Array.isArray(interviewResult.eligibleInitial) ? interviewResult.eligibleInitial : []);
                } else {
                    setInterviews([]);
                    setInterviewInitialRows([]);
                }
            } catch {
                setInterviews([]);
                setInterviewInitialRows([]);
            }
        } catch (err) {
            const e = err as Error;
            setError(e.message);
            toast.error(e.message || "Could not load recommendations");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const submitRecommendation = useCallback(async (data: ManpowerRecommendationCreateInput): Promise<boolean> => {
        try {
            const response = await fetch(API_PATH, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || errData.error || "Failed to submit recommendation");
            }
            toast.success("Manpower Recommendation created successfully!");
            await refresh();
            return true;
        } catch (err) {
            toast.error((err as Error).message || "Could not create recommendation");
            return false;
        }
    }, [refresh]);

    const updateRecommendation = useCallback(async (id: number, data: Partial<ManpowerRecommendation>): Promise<boolean> => {
        try {
            const response = await fetch(`${API_PATH}/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || errData.error || "Failed to update recommendation");
            }
            toast.success("Manpower Recommendation updated!");
            await refresh();
            return true;
        } catch (err) {
            toast.error((err as Error).message || "Could not update recommendation");
            return false;
        }
    }, [refresh]);

    const deleteRecommendation = useCallback(async (id: number): Promise<boolean> => {
        try {
            const response = await fetch(`${API_PATH}/${id}`, { method: "DELETE" });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || errData.error || "Failed to delete recommendation");
            }
            toast.success("Manpower Recommendation deleted");
            await refresh();
            return true;
        } catch (err) {
            toast.error((err as Error).message || "Could not delete recommendation");
            return false;
        }
    }, [refresh]);

    const contextValue = useMemo(() => ({
        recommendations, applicants, openRequests, divisions, users, interviews, interviewInitialRows, isLoading, error, isCreateOpen, setIsCreateOpen,
        selectedRecommendation, setSelectedRecommendation, isViewOpen, setIsViewOpen,
        pendingRequestId, setPendingRequestId, openRecommendForm, selectedRequest, setSelectedRequest, isDetailOpen, setIsDetailOpen,
        refresh, submitRecommendation, updateRecommendation, deleteRecommendation
    }), [recommendations, applicants, openRequests, divisions, users, interviews, interviewInitialRows, isLoading, error, isCreateOpen, selectedRecommendation, isViewOpen, pendingRequestId, setPendingRequestId, openRecommendForm, selectedRequest, setSelectedRequest, isDetailOpen, setIsDetailOpen, refresh, submitRecommendation, updateRecommendation, deleteRecommendation]);

    return (
        <ManpowerRecommendationContext.Provider value={contextValue}>
            {children}
        </ManpowerRecommendationContext.Provider>
    );
}

/**
 * Access the manpower recommendation context. Throws when used outside the provider.
 */
export function useManpowerRecommendationContext() {
    const context = useContext(ManpowerRecommendationContext);
    if (context === undefined) {
        throw new Error("useManpowerRecommendationContext must be used within a ManpowerRecommendationProvider");
    }
    return context;
}
