"use client";

import React, { createContext, useCallback, useEffect, useState } from "react";
import { Memo, Company } from "../types";
import { MemoAcknowledgementService } from "../services/MemoAcknowledgementService";

interface MemoAcknowledgementContextValue {
    memos: Memo[];
    companies: Company[];
    isLoading: boolean;
    refreshMemos: () => Promise<void>;
}

export const MemoAcknowledgementContext = createContext<MemoAcknowledgementContextValue | undefined>(undefined);

export function MemoAcknowledgementProvider({ children }: { children: React.ReactNode }) {
    const [memos, setMemos] = useState<Memo[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refreshMemos = useCallback(async () => {
        setIsLoading(true);
        try {
            const [memoData, companyData] = await Promise.all([
                MemoAcknowledgementService.getReleasedMemos(),
                MemoAcknowledgementService.getCompanies()
            ]);
            setMemos(memoData);
            setCompanies(companyData);
        } catch (error) {
            console.error("Failed to fetch memos or companies in acknowledgement provider:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshMemos();
    }, [refreshMemos]);

    return (
        <MemoAcknowledgementContext.Provider
            value={{
                memos,
                companies,
                isLoading,
                refreshMemos,
            }}
        >
            {children}
        </MemoAcknowledgementContext.Provider>
    );
}
