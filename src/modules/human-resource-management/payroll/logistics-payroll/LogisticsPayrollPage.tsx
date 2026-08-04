/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React from "react";
import { LogisticsPayrollProvider, useLogisticsPayrollContext } from "./providers/LogisticsPayrollProvider";
import { LogisticsPayrollHeader } from "./components/LogisticsPayrollHeader";
import { LogisticsPayrollTable } from "./components/LogisticsPayrollTable";
import { DailyDispatchPayrollTable } from "./components/DailyDispatchPayrollTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function LogisticsPayrollContent() {
    const { refresh } = useLogisticsPayrollContext();

    // Initial load is now handled by LogisticsPayrollHeader

    return (
        <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto bg-slate-50/50">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Logistics Payroll</h1>
                <p className="text-muted-foreground">
                    Manage other additions for logistics personnel based on specific cutoff periods.
                </p>
            </div>
            
            <LogisticsPayrollHeader />
            
            <Tabs defaultValue="dispatch-view" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="dispatch-view">Dispatch View</TabsTrigger>
                    <TabsTrigger value="staff-view">Staff View</TabsTrigger>
                </TabsList>
                <TabsContent value="dispatch-view" className="m-0 border-none p-0 outline-none">
                    <DailyDispatchPayrollTable />
                </TabsContent>
                <TabsContent value="staff-view" className="m-0 border-none p-0 outline-none">
                    <LogisticsPayrollTable />
                </TabsContent>
            </Tabs>
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
