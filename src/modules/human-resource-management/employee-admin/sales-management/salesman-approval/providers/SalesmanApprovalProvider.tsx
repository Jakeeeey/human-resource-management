"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useSalesmanApproval } from "../hooks/useSalesmanApproval";

type SalesmanApprovalHookType = ReturnType<typeof useSalesmanApproval>;

const SalesmanApprovalContext = createContext<SalesmanApprovalHookType | undefined>(undefined);

export function SalesmanApprovalProvider({ children }: { children: ReactNode }) {
    const approvalHook = useSalesmanApproval();

    return (
        <SalesmanApprovalContext.Provider value={approvalHook}>
            {children}
        </SalesmanApprovalContext.Provider>
    );
}

export function useSalesmanApprovalContext() {
    const context = useContext(SalesmanApprovalContext);
    if (context === undefined) {
        throw new Error("useSalesmanApprovalContext must be used within a SalesmanApprovalProvider");
    }
    return context;
}
