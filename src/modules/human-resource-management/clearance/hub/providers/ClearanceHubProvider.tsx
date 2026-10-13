"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useClearanceHub } from "../hooks/useClearanceHub";

type ClearanceHubContextValue = ReturnType<typeof useClearanceHub>;

const ClearanceHubContext = createContext<ClearanceHubContextValue | undefined>(undefined);

export function ClearanceHubProvider({ children }: { children: ReactNode }) {
    const hub = useClearanceHub();
    const { refreshLookups } = hub;

    useEffect(() => {
        refreshLookups();
    }, [refreshLookups]);

    return (
        <ClearanceHubContext.Provider value={hub}>
            {children}
        </ClearanceHubContext.Provider>
    );
}

export function useClearanceHubContext(): ClearanceHubContextValue {
    const context = useContext(ClearanceHubContext);
    if (context === undefined) {
        throw new Error("useClearanceHubContext must be used within a ClearanceHubProvider");
    }
    return context;
}
