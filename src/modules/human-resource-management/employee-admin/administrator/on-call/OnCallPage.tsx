"use client";

import React from "react";
import { OnCallProvider } from "./providers/OnCallProvider";
import { OnCallTable } from "./components/OnCallTable";
import { ScmAdvancedFilters } from "@/modules/human-resource-management/employee-admin/administrator/components/filters/ScmAdvancedFilters";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { useOnCall } from "./hooks/useOnCall";
import { OnCallDialog } from "./components/OnCallDialog";
import { ScmFilterProvider } from "@/modules/human-resource-management/employee-admin/administrator/providers/ScmFilterProvider";
import { useDepartments } from "../../structrure/department/hooks/userDepartments";
import { DepartmentFilterProvider } from "../../structrure/department/providers/DepartmentFilterProvider";

/**
 * OnCallPage
 * Main entry point for the On-Call module in Administrator.
 */
export default function OnCallPage() {
    return (
        <ScmFilterProvider>
            <OnCallProvider>
                <DepartmentFilterProvider>
                    <OnCallContent />
                </DepartmentFilterProvider>
            </OnCallProvider>
        </ScmFilterProvider>
    );
}

function OnCallContent() {
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const { departments, users, isLoading: isLoadingDeps } = useDepartments();
    const { refresh, isLoading: isRefreshing } = useOnCall();

    const mappedDepartments = React.useMemo(() => {
        return departments.map((d: { department_id: number | string; department_name: string }) => ({
            id: d.department_name,
            name: d.department_name
        }));
    }, [departments]);

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">On-Call Schedules</h1>
                    <p className="text-muted-foreground">
                        Manage department on-call schedules and assignments
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={refresh}
                        disabled={isRefreshing}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create Schedule
                    </Button>
                </div>
            </div>

            <div className="bg-card rounded-xl border p-4 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">All Schedules</h2>
                    <ScmAdvancedFilters
                        departments={mappedDepartments}
                        showDepartment={true}
                        showSupplier={false}
                        showDateRange={false}
                        suppliers={[]}
                    />
                </div>

                <OnCallTable departments={departments} users={users} isLoadingDeps={isLoadingDeps} />
            </div>


            <OnCallDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                departments={departments}
                users={users}
                isLoadingDeps={isLoadingDeps}
            />
        </div>
    );
}
