"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useMemo,
} from "react";
import { toast } from "sonner";
import {
    EnrichedEmployeeConcern,
    EmployeeConcernForm,
    ConcernStatus,
} from "../types/employee-concern.schema";

const API_PATH = "/api/hrm/communications/employee-concerns";

interface EmployeeConcernContextType {
    concerns: EnrichedEmployeeConcern[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    submitConcern: (form: EmployeeConcernForm) => Promise<boolean>;
    updateStatus: (id: number, status: ConcernStatus) => Promise<boolean>;
    deleteConcern: (id: number) => Promise<boolean>;
}

const EmployeeConcernContext = createContext<EmployeeConcernContextType | undefined>(undefined);

export function EmployeeConcernProvider({ children }: { children: React.ReactNode }) {
    const [concerns, setConcerns] = useState<EnrichedEmployeeConcern[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(API_PATH);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to load concerns");
            }
            const result = await response.json();
            setConcerns(result.data as EnrichedEmployeeConcern[]);
        } catch (err) {
            const e = err as Error;
            setError(e.message);
            toast.error(e.message || "Could not load concerns");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const submitConcern = useCallback(
        async (form: EmployeeConcernForm): Promise<boolean> => {
            try {
                const response = await fetch(API_PATH, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                });
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || "Failed to submit concern");
                }
                toast.success("Your concern has been submitted");
                await refresh();
                return true;
            } catch (err) {
                toast.error((err as Error).message || "Could not submit concern");
                return false;
            }
        },
        [refresh]
    );

    const updateStatus = useCallback(
        async (id: number, status: ConcernStatus): Promise<boolean> => {
            try {
                const response = await fetch(`${API_PATH}/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status }),
                });
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || "Failed to update status");
                }
                toast.success(`Marked as ${status.replace("_", " ").toLowerCase()}`);
                await refresh();
                return true;
            } catch (err) {
                toast.error((err as Error).message || "Could not update status");
                return false;
            }
        },
        [refresh]
    );

    const deleteConcern = useCallback(
        async (id: number): Promise<boolean> => {
            try {
                const response = await fetch(`${API_PATH}/${id}`, { method: "DELETE" });
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || "Failed to delete concern");
                }
                toast.success("Concern deleted");
                await refresh();
                return true;
            } catch (err) {
                toast.error((err as Error).message || "Could not delete concern");
                return false;
            }
        },
        [refresh]
    );

    const contextValue = useMemo(
        () => ({
            concerns,
            isLoading,
            error,
            refresh,
            submitConcern,
            updateStatus,
            deleteConcern,
        }),
        [concerns, isLoading, error, refresh, submitConcern, updateStatus, deleteConcern]
    );

    return (
        <EmployeeConcernContext.Provider value={contextValue}>
            {children}
        </EmployeeConcernContext.Provider>
    );
}

export function useEmployeeConcernContext() {
    const context = useContext(EmployeeConcernContext);
    if (context === undefined) {
        throw new Error("useEmployeeConcernContext must be used within an EmployeeConcernProvider");
    }
    return context;
}
