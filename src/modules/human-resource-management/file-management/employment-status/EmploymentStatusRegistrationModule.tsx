"use client";

import React from "react";
import type { EmploymentStatusFormData } from "./types";
import { EmploymentStatusFilterProvider } from "./providers/filterProvider";
import { EmploymentStatusFetchProvider } from "./providers/fetchProvider";
import { useEmploymentStatusRegistration } from "./hooks/useEmploymentStatusRegistration";
import { EmploymentStatusRegistrationTable } from "./components/EmploymentStatusRegistrationTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

function EmploymentStatusRegistrationModuleContent() {
    const {
        records,
        isLoading,
        isError,
        error,
        refetch,
        createRecord,
        updateRecord,
    } = useEmploymentStatusRegistration();

    const handleCreate = async (data: EmploymentStatusFormData) => {
        try {
            await createRecord(data);
            toast.success("Employment status created successfully");
        } catch {
            toast.error("Failed to create employment status");
            throw new Error("Create failed");
        }
    };

    const handleUpdate = async (id: number, data: EmploymentStatusFormData) => {
        try {
            await updateRecord(id, data);
            toast.success("Employment status updated successfully");
        } catch {
            toast.error("Failed to update employment status");
            throw new Error("Update failed");
        }
    };


    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                    <span>
                        Failed to load employment statuses:{" "}
                        {error?.message || "Unknown error"}
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
                        Employment Status Registration
                    </h1>
                    <p className="text-muted-foreground">
                        Manage employment status
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <EmploymentStatusRegistrationTable
                data={records}
                isLoading={isLoading}
                onCreateRecord={handleCreate}
                onUpdateRecord={handleUpdate}
    
            />
        </div>
    );
}

export default function EmploymentStatusRegistrationModule() {
    return (
        <EmploymentStatusFetchProvider>
            <EmploymentStatusFilterProvider>
                <EmploymentStatusRegistrationModuleContent />
            </EmploymentStatusFilterProvider>
        </EmploymentStatusFetchProvider>
    );
}
