"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ApplicantRow } from "../types";

interface ApplicantFetchContextType {
    allApplicants: ApplicantRow[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    refresh: () => Promise<void>;
}

const ApplicantFetchContext = createContext<ApplicantFetchContextType | undefined>(undefined);

export function ApplicantFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [allApplicants, setAllApplicants] = useState<ApplicantRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);

            const res = await fetch("/api/hrm/applicants", {
                cache: "no-store",
            });

            if (!res.ok) throw new Error("Fetch failed");

            const data = await res.json();
            setAllApplicants(data.data || []);
        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return React.createElement(
        ApplicantFetchContext.Provider,
        { value: { allApplicants, isLoading, isError, error, refetch: fetchData, refresh: fetchData } },
        children
    );
}

export function useApplicantFetchContext() {
    const ctx = useContext(ApplicantFetchContext);
    if (!ctx) throw new Error("Must be used inside ApplicantFetchProvider");
    return ctx;
}
