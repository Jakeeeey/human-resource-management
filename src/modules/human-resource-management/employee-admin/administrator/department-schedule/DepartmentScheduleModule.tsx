"use client";

import React from "react";
import { DepartmentScheduleFilterProvider } from "./providers/DepartmentScheduleFilterProvider";
import { useDepartmentSchedules } from "./hooks/useDepartmentSchedules";
import { DepartmentScheduleTable } from "./components/DepartmentScheduleTable";

import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner"; // ✅ keep this

function DepartmentScheduleModuleContent() {
    const {
        schedules,
        departments,
        // users,
        isLoading,
        isError,
        error,
        refetch,
        createSchedule,
        updateSchedule,
        deleteSchedule,
    } = useDepartmentSchedules();

    // ✅ sonner toast only
    const handleCreate = async (data: Record<string, unknown>) => {
        try {
            await createSchedule(data);
            toast.success("Schedule created successfully");
        } catch (error) {
            toast.error("Failed to create schedule");
            throw error;
        }
    };

    const handleUpdate = async (id: number, data: Record<string, unknown>) => {
        try {
            await updateSchedule(id, data);
            toast.success("Schedule updated successfully");
        } catch (error) {
            toast.error("Failed to update schedule");
            throw error;
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteSchedule(id);
            toast.success("Schedule deleted successfully");
        } catch (error) {
            toast.error("Failed to delete schedule");
            throw error;
        }
    };

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                    <span>
                        Failed to load schedules: {error?.message || "Unknown error"}
                    </span>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        className="ml-4"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Department Schedules
                    </h1>
                    <p className="text-muted-foreground">
                        Manage work schedules for all departments
                    </p>
                </div>

                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <DepartmentScheduleTable
                data={schedules}
                departments={departments}
                isLoading={isLoading}
                onCreateSchedule={handleCreate}
                onUpdateSchedule={handleUpdate}
                onDeleteSchedule={handleDelete}
            />
        </div>
    );
}

export default function DepartmentScheduleModule() {
    return (
        <DepartmentScheduleFilterProvider>
            <DepartmentScheduleModuleContent />
        </DepartmentScheduleFilterProvider>
    );
}
