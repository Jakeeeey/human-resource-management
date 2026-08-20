"use client";

import React, { createContext, useCallback, useEffect, useState } from "react";
import { Memo, Company } from "../types";
import { MemoSummaryService } from "../services/MemoSummaryService";

interface MemoSummaryContextValue {
    memos: Memo[];
    companies: Company[];
    isLoading: boolean;
    refreshMemos: () => Promise<void>;
}

export const MemoSummaryContext = createContext<MemoSummaryContextValue | undefined>(undefined);

export function MemoSummaryProvider({ children }: { children: React.ReactNode }) {
    const [memos, setMemos] = useState<Memo[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refreshMemos = useCallback(async () => {
        setIsLoading(true);
        try {
            const [memoData, companyData] = await Promise.all([
                MemoSummaryService.getMemos(),
                MemoSummaryService.getCompanies()
            ]);
            setMemos(memoData);
            setCompanies(companyData);
        } catch (error) {
            console.error("Failed to fetch memos or companies in summary:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshMemos();
    }, [refreshMemos]);

    return (
        <MemoSummaryContext.Provider
            value={{
                memos,
                companies,
                isLoading,
                refreshMemos,
            }}
        >
            {children}
        </MemoSummaryContext.Provider>
    );
}
