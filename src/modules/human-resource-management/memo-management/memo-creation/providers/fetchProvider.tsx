"use client";

import React, { createContext, useCallback, useEffect, useState } from "react";
import { Memo, Company } from "../types";
import { MemoCreationService } from "../services/MemoCreationService";

interface MemoFetchContextValue {
    memos: Memo[];
    companies: Company[];
    isLoading: boolean;
    refreshMemos: (search?: string) => Promise<void>;
}

export const MemoFetchContext = createContext<MemoFetchContextValue | undefined>(undefined);

export function MemoFetchProvider({ children }: { children: React.ReactNode }) {
    const [memos, setMemos] = useState<Memo[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refreshMemos = useCallback(async (search?: string) => {
        setIsLoading(true);
        try {
            const [memoData, companyData] = await Promise.all([
                MemoCreationService.getMemos(search),
                MemoCreationService.getCompanies()
            ]);
            setMemos(memoData);
            setCompanies(companyData);
        } catch (error) {
            console.error("Failed to fetch memos or companies", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshMemos();
    }, [refreshMemos]);

    return (
        <MemoFetchContext.Provider
            value={{
                memos,
                companies,
                isLoading,
                refreshMemos,
            }}
        >
            {children}
        </MemoFetchContext.Provider>
    );
}
