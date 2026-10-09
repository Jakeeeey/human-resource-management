"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { useMsGroups } from "../hooks/useMsGroups";
import type { MsGroupRow } from "../types";

interface MsGroupsContextValue {
    readonly groups: MsGroupRow[] | null;
    readonly isLoading: boolean;
    readonly error: string | null;
    readonly refresh: () => Promise<void>;
}

const MsGroupsContext = createContext<MsGroupsContextValue | null>(null);

export function MsGroupsProvider({ children }: { readonly children: ReactNode }) {
    const { data, isLoading, error, refresh } = useMsGroups();
    const value = useMemo<MsGroupsContextValue>(
        () => ({ groups: data, isLoading, error, refresh }),
        [data, isLoading, error, refresh]
    );
    return <MsGroupsContext.Provider value={value}>{children}</MsGroupsContext.Provider>;
}

export function useMsGroupsContext(): MsGroupsContextValue {
    const value = useContext(MsGroupsContext);
    if (!value) throw new Error("useMsGroupsContext must be used inside MsGroupsProvider.");
    return value;
}
