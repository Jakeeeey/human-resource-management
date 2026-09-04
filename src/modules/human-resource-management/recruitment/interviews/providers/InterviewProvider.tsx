"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Interview, InterviewCreateInput } from "../types";

const API_PATH = "/api/hrm/interviews";

/**
 * Grading stage tab shared by the eligible list and the score entry dialog.
 */
export type InterviewStageTab = "Initial" | "Final";

/**
 * Which eligible row the score entry dialog is grading.
 * Initial grades carry an applicationId; Final grades carry a recommendationId
 * (plus the applicationId for display joins).
 */
export interface InterviewGradeContext {
    stage: "Initial" | "Final";
    applicationId?: number;
    recommendationId?: number;
}

/**
 * Quiz-completed application row from the GET envelope, annotated with its
 * latest Initial-stage verdict (null when never graded).
 */
export interface EligibleInitialRow {
    id: number;
    applicant_id: number;
    quiz_score: number | null;
    quiz_passed: boolean | null;
    submitted_at: string | null;
    full_name: string;
    latestInitialVerdict: string | null;
}

/**
 * Approved recommendation row from the GET envelope, annotated with its
 * latest Final-stage verdict (null when never graded).
 */
export interface EligibleFinalRow {
    id: number;
    applicant_id: number | null;
    manpower_request_id: number | null;
    status: string;
    full_name: string;
    latestFinalVerdict: string | null;
}

/**
 * Single criterion score payload for the interview create flow.
 * Mirrors the server-side flow-item shape (client-safe copy — the service
 * layer must never be imported into client code).
 */
export interface InterviewScoreItemInput {
    criterion_id: number | null;
    criterion_name_snapshot: string;
    weight_percentage_snapshot: number;
    is_quiz_criterion: boolean;
    score: number;
    sort: number;
}

interface InterviewContextType {
    interviews: Interview[];
    eligibleInitial: EligibleInitialRow[];
    eligibleFinal: EligibleFinalRow[];
    users: { id: number | string; name: string }[];
    isLoading: boolean;
    error: string | null;
    stageTab: InterviewStageTab;
    setStageTab: (tab: InterviewStageTab) => void;
    selectedInterview: Interview | null;
    setSelectedInterview: (interview: Interview | null) => void;
    isGradeOpen: boolean;
    setIsGradeOpen: (isOpen: boolean) => void;
    gradeContext: InterviewGradeContext;
    setGradeContext: (context: InterviewGradeContext) => void;
    refresh: () => Promise<void>;
    submitInterview: (data: InterviewCreateInput & { items: InterviewScoreItemInput[] }) => Promise<boolean>;
    updateInterview: (id: number, data: Partial<Interview>) => Promise<boolean>;
    deleteInterview: (id: number) => Promise<boolean>;
}

const InterviewContext = createContext<InterviewContextType | undefined>(undefined);

/**
 * Client-side provider for applicant interview grading.
 * Fetches the T4 GET envelope ({ data, eligibleInitial, eligibleFinal, users })
 * and exposes list state plus stage-tab / grade-dialog state and mutations.
 * Client sends no timestamps — the server injects interviewed_at/created_at
 * via nowPH() and interviewed_by/updated_by from the JWT.
 */
export function InterviewProvider({ children }: { children: React.ReactNode }) {
    const [interviews, setInterviews] = useState<Interview[]>([]);
    const [eligibleInitial, setEligibleInitial] = useState<EligibleInitialRow[]>([]);
    const [eligibleFinal, setEligibleFinal] = useState<EligibleFinalRow[]>([]);
    const [users, setUsers] = useState<{ id: number | string; name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stageTab, setStageTab] = useState<InterviewStageTab>("Initial");
    const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
    const [isGradeOpen, setIsGradeOpen] = useState(false);
    const [gradeContext, setGradeContext] = useState<InterviewGradeContext>({ stage: "Initial" });

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(API_PATH);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || errData.error || "Failed to load interviews");
            }
            const result = await response.json();
            setInterviews(Array.isArray(result.data) ? result.data : []);
            setEligibleInitial(Array.isArray(result.eligibleInitial) ? result.eligibleInitial : []);
            setEligibleFinal(Array.isArray(result.eligibleFinal) ? result.eligibleFinal : []);
            setUsers(Array.isArray(result.users) ? result.users : []);
        } catch (err) {
            const e = err as Error;
            setError(e.message);
            toast.error(e.message || "Could not load interviews");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const submitInterview = useCallback(async (data: InterviewCreateInput & { items: InterviewScoreItemInput[] }): Promise<boolean> => {
        try {
            const response = await fetch(API_PATH, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || errData.error || "Failed to submit interview");
            }
            toast.success("Interview graded successfully!");
            await refresh();
            return true;
        } catch (err) {
            toast.error((err as Error).message || "Could not submit interview");
            return false;
        }
    }, [refresh]);

    const updateInterview = useCallback(async (id: number, data: Partial<Interview>): Promise<boolean> => {
        try {
            const response = await fetch(`${API_PATH}/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || errData.error || "Failed to update interview");
            }
            toast.success("Interview updated!");
            await refresh();
            return true;
        } catch (err) {
            toast.error((err as Error).message || "Could not update interview");
            return false;
        }
    }, [refresh]);

    const deleteInterview = useCallback(async (id: number): Promise<boolean> => {
        try {
            const response = await fetch(`${API_PATH}/${id}`, { method: "DELETE" });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || errData.error || "Failed to delete interview");
            }
            toast.success("Interview deleted");
            await refresh();
            return true;
        } catch (err) {
            toast.error((err as Error).message || "Could not delete interview");
            return false;
        }
    }, [refresh]);

    const contextValue = useMemo(() => ({
        interviews, eligibleInitial, eligibleFinal, users, isLoading, error,
        stageTab, setStageTab, selectedInterview, setSelectedInterview,
        isGradeOpen, setIsGradeOpen, gradeContext, setGradeContext,
        refresh, submitInterview, updateInterview, deleteInterview
    }), [interviews, eligibleInitial, eligibleFinal, users, isLoading, error, stageTab, selectedInterview, isGradeOpen, gradeContext, refresh, submitInterview, updateInterview, deleteInterview]);

    return (
        <InterviewContext.Provider value={contextValue}>
            {children}
        </InterviewContext.Provider>
    );
}

/**
 * Access the interview grading context. Throws when used outside the provider.
 */
export function useInterviewContext() {
    const context = useContext(InterviewContext);
    if (context === undefined) {
        throw new Error("useInterviewContext must be used within an InterviewProvider");
    }
    return context;
}
