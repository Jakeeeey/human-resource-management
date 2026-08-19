"use client";

import React, { createContext, useCallback, useEffect, useState } from "react";
import { Memo, Company } from "../types";
import { MemoReleasingService } from "../services/MemoReleasingService";

interface MemoReleasingContextValue {
    memos: Memo[];
    companies: Company[];
    isLoading: boolean;
    refreshMemos: (search?: string) => Promise<void>;
}

export const MemoReleasingContext = createContext<MemoReleasingContextValue | undefined>(undefined);

export function MemoReleasingProvider({ children }: { children: React.ReactNode }) {
    const [memos, setMemos] = useState<Memo[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refreshMemos = useCallback(async (search?: string) => {
        setIsLoading(true);
        try {
            const [memoData, companyData] = await Promise.all([
                MemoReleasingService.getApprovedMemos(search),
                MemoReleasingService.getCompanies()
            ]);
            setMemos(memoData);
            setCompanies(companyData);
        } catch (error) {
            console.error("Failed to fetch memos or companies in releasing:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshMemos();
    }, [refreshMemos]);

    return (
        <MemoReleasingContext.Provider
            value={{
                memos,
                companies,
                isLoading,
                refreshMemos,
            }}
        >
            {children}
        </MemoReleasingContext.Provider>
    );
}
