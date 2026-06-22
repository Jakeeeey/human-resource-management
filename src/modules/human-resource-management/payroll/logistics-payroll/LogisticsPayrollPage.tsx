"use client";

import React from "react";
import { LogisticsPayrollProvider, useLogisticsPayrollContext } from "./providers/LogisticsPayrollProvider";
import { LogisticsPayrollHeader } from "./components/LogisticsPayrollHeader";
import { LogisticsPayrollTable } from "./components/LogisticsPayrollTable";

function LogisticsPayrollContent() {
    const { refresh } = useLogisticsPayrollContext();

    // Initial load is now handled by LogisticsPayrollHeader

    return (
        <div className="flex flex-col gap-6 p-6 min-h-screen bg-slate-50/50">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Logistics Payroll</h1>
                <p className="text-muted-foreground">
                    Manage other additions for logistics personnel based on specific cutoff periods.
                </p>
            </div>
            
            <LogisticsPayrollHeader />
            <LogisticsPayrollTable />
        </div>
    );
}

export default function LogisticsPayrollPage() {
    return (
        <LogisticsPayrollProvider>
            <LogisticsPayrollContent />
        </LogisticsPayrollProvider>
    );
}
