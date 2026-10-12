"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useResignationApproval } from "../hooks/useResignationApproval";

type ResignationApprovalContextValue = ReturnType<typeof useResignationApproval>;

const ResignationApprovalContext = createContext<ResignationApprovalContextValue | undefined>(undefined);

export function ResignationApprovalProvider({ children }: { children: ReactNode }) {
    const approval = useResignationApproval();
    const { refresh } = approval;

    useEffect(() => {
        refresh();
    }, [refresh]);

    return (
        <ResignationApprovalContext.Provider value={approval}>
            {children}
        </ResignationApprovalContext.Provider>
    );
}

export function useResignationApprovalContext(): ResignationApprovalContextValue {
    const context = useContext(ResignationApprovalContext);
    if (context === undefined) {
        throw new Error("useResignationApprovalContext must be used within a ResignationApprovalProvider");
    }
    return context;
}
