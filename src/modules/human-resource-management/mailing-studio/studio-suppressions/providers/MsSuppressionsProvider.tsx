"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { useMsSuppressions } from "../hooks/useMsSuppressions";
import type { MsSuppressionRow } from "../types";

interface MsSuppressionsContextValue {
    readonly suppressions: MsSuppressionRow[] | null;
    readonly total: number;
    readonly isLoading: boolean;
    readonly error: string | null;
    readonly refresh: () => Promise<void>;
}

const MsSuppressionsContext = createContext<MsSuppressionsContextValue | null>(null);

export function MsSuppressionsProvider({ children }: { readonly children: ReactNode }) {
    const { data, total, isLoading, error, refresh } = useMsSuppressions();
    const value = useMemo<MsSuppressionsContextValue>(
        () => ({ suppressions: data, total, isLoading, error, refresh }),
        [data, total, isLoading, error, refresh]
    );
    return <MsSuppressionsContext.Provider value={value}>{children}</MsSuppressionsContext.Provider>;
}

export function useMsSuppressionsContext(): MsSuppressionsContextValue {
    const value = useContext(MsSuppressionsContext);
    if (!value) throw new Error("useMsSuppressionsContext must be used inside MsSuppressionsProvider.");
    return value;
}
