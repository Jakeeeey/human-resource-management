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
    EnrichedCompanyMemo,
    CompanyMemoForm,
} from "../types/company-memo.schema";

const API_PATH = "/api/hrm/communications/company-memo";

interface CompanyMemoContextType {
    memos: EnrichedCompanyMemo[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    submitMemo: (form: CompanyMemoForm) => Promise<boolean>;
    updateMemo: (id: number, data: Partial<CompanyMemoForm>) => Promise<boolean>;
    deleteMemo: (id: number) => Promise<boolean>;
}

const CompanyMemoContext = createContext<CompanyMemoContextType | undefined>(undefined);

export function CompanyMemoProvider({ children }: { children: React.ReactNode }) {
    const [memos, setMemos] = useState<EnrichedCompanyMemo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(API_PATH);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to load memos");
            }
            const result = await response.json();
            setMemos(result.data as EnrichedCompanyMemo[]);
        } catch (err) {
            const e = err as Error;
            setError(e.message);
            toast.error(e.message || "Could not load memos");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const submitMemo = useCallback(
        async (form: CompanyMemoForm): Promise<boolean> => {
            try {
                const response = await fetch(API_PATH, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                });
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || "Failed to submit memo");
                }
                toast.success("Memo has been created");
                await refresh();
                return true;
            } catch (err) {
                toast.error((err as Error).message || "Could not create memo");
                return false;
            }
        },
        [refresh]
    );

    const updateMemo = useCallback(
        async (id: number, data: Partial<CompanyMemoForm>): Promise<boolean> => {
            try {
                const response = await fetch(`${API_PATH}/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || "Failed to update memo");
                }
                toast.success(`Memo updated`);
                await refresh();
                return true;
            } catch (err) {
                toast.error((err as Error).message || "Could not update memo");
                return false;
            }
        },
        [refresh]
    );

    const deleteMemo = useCallback(
        async (id: number): Promise<boolean> => {
            try {
                const response = await fetch(`${API_PATH}/${id}`, { method: "DELETE" });
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || "Failed to delete memo");
                }
                toast.success("Memo deleted");
                await refresh();
                return true;
            } catch (err) {
                toast.error((err as Error).message || "Could not delete memo");
                return false;
            }
        },
        [refresh]
    );

    const contextValue = useMemo(
        () => ({
            memos,
            isLoading,
            error,
            refresh,
            submitMemo,
            updateMemo,
            deleteMemo,
        }),
        [memos, isLoading, error, refresh, submitMemo, updateMemo, deleteMemo]
    );

    return (
        <CompanyMemoContext.Provider value={contextValue}>
            {children}
        </CompanyMemoContext.Provider>
    );
}

export function useCompanyMemoContext() {
    const context = useContext(CompanyMemoContext);
    if (context === undefined) {
        throw new Error("useCompanyMemoContext must be used within a CompanyMemoProvider");
    }
    return context;
}
