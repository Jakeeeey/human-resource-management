"use client";

import React from "react";
import type { EmployeeTypeFormData } from "./types";
import { EmployeeTypeFilterProvider } from "./providers/filterProvider";
import { EmployeeTypeFetchProvider } from "./providers/fetchProvider";
import { useEmployeeType } from "./hooks/useEmployeeType";
import { EmployeeTypeTable } from "./components/EmployeeTypeTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

function EmployeeTypeModuleContent() {
    const {
        records,
        isLoading,
        isError,
        error,
        refetch,
        createRecord,
        updateRecord,
    } = useEmployeeType();

    const handleCreate = async (data: EmployeeTypeFormData) => {
        try {
            await createRecord(data);
            toast.success("Employee type created successfully");
        } catch {
            toast.error("Failed to create employee type");
            throw new Error("Create failed");
        }
    };

    const handleUpdate = async (id: number, data: EmployeeTypeFormData) => {
        try {
            await updateRecord(id, data);
            toast.success("Employee type updated successfully");
        } catch {
            toast.error("Failed to update employee type");
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
                        Failed to load employee types:{" "}
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
                        Employee Type Registration
                    </h1>
                    <p className="text-muted-foreground">
                        Manage employee types
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <EmployeeTypeTable
                data={records}
                isLoading={isLoading}
                onCreateRecord={handleCreate}
                onUpdateRecord={handleUpdate}
            />
        </div>
    );
}

export function EmployeeTypeModule() {
    return (
        <EmployeeTypeFetchProvider>
            <EmployeeTypeFilterProvider>
                <EmployeeTypeModuleContent />
            </EmployeeTypeFilterProvider>
        </EmployeeTypeFetchProvider>
    );
}
