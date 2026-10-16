"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useResignationAcknowledgement } from "../hooks/useResignationAcknowledgement";

type ResignationAcknowledgementContextValue = ReturnType<typeof useResignationAcknowledgement>;

const ResignationAcknowledgementContext = createContext<ResignationAcknowledgementContextValue | undefined>(undefined);

export function ResignationAcknowledgementProvider({ children }: { children: ReactNode }) {
    const acknowledgement = useResignationAcknowledgement();
    const { refresh } = acknowledgement;

    useEffect(() => {
        refresh();
    }, [refresh]);

    return (
        <ResignationAcknowledgementContext.Provider value={acknowledgement}>
            {children}
        </ResignationAcknowledgementContext.Provider>
    );
}

export function useResignationAcknowledgementContext(): ResignationAcknowledgementContextValue {
    const context = useContext(ResignationAcknowledgementContext);
    if (context === undefined) {
        throw new Error("useResignationAcknowledgementContext must be used within a ResignationAcknowledgementProvider");
    }
    return context;
}
