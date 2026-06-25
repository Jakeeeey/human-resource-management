"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useLogisticsPayroll } from "../hooks/useLogisticsPayroll";

type LogisticsPayrollContextType = ReturnType<typeof useLogisticsPayroll> & {
    approvePayroll: (staffId: number, amount: number, dispatchDocNo: string, role?: string, areaName?: string, dispatchDate?: string) => Promise<void>;
};

const LogisticsPayrollContext = createContext<LogisticsPayrollContextType | undefined>(undefined);

export function LogisticsPayrollProvider({ children }: { children: ReactNode }) {
    const payrollState = useLogisticsPayroll();
    const { approvePayroll } = payrollState;

    return (
        <LogisticsPayrollContext.Provider value={{ ...payrollState, approvePayroll }}>
            {children}
        </LogisticsPayrollContext.Provider>
    );
}

export function useLogisticsPayrollContext() {
    const context = useContext(LogisticsPayrollContext);
    if (context === undefined) {
        throw new Error("useLogisticsPayrollContext must be used within a LogisticsPayrollProvider");
    }
    return context;
}
