"use client";

import React, { createContext, useCallback, useEffect, useState } from "react";
import { Memo, Company } from "../types";
import { MemoApprovalService } from "../services/MemoApprovalService";

interface MemoApprovalContextValue {
    memos: Memo[];
    companies: Company[];
    isLoading: boolean;
    refreshMemos: (search?: string) => Promise<void>;
}

export const MemoApprovalContext = createContext<MemoApprovalContextValue | undefined>(undefined);

export function MemoApprovalProvider({ children }: { children: React.ReactNode }) {
    const [memos, setMemos] = useState<Memo[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refreshMemos = useCallback(async (search?: string) => {
        setIsLoading(true);
        try {
            const [memoData, companyData] = await Promise.all([
                MemoApprovalService.getSubmittedMemos(search),
                MemoApprovalService.getCompanies()
            ]);
            setMemos(memoData);
            setCompanies(companyData);
        } catch (error) {
            console.error("Failed to fetch memos or companies in approval:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshMemos();
    }, [refreshMemos]);

    return (
        <MemoApprovalContext.Provider
            value={{
                memos,
                companies,
                isLoading,
                refreshMemos,
            }}
        >
            {children}
        </MemoApprovalContext.Provider>
    );
}
