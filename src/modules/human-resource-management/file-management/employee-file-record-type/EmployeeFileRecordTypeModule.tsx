"use client";

import React from "react";
import type { EmployeeFileRecordTypeFormData } from "./types";
import { EmployeeFileRecordTypeFilterProvider } from "./providers/filterProvider";
import { EmployeeFileRecordTypeFetchProvider } from "./providers/fetchProvider";
import { useEmployeeFileRecordType } from "./hooks/useEmployeeFileRecordType";
import { EmployeeFileRecordTypeTable } from "./components/EmployeeFileRecordTypeTable";
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// INNER COMPONENT (Has access to context)
// ============================================================================

function EmployeeFileRecordTypeModuleContent() {
    const {
        records,
        isLoading,
        isError,
        error,
        refetch,
        createRecord,
        updateRecord,
        deleteRecord,
    } = useEmployeeFileRecordType();

    const handleCreate = async (data: EmployeeFileRecordTypeFormData) => {
        try {
            await createRecord(data);
            toast.success("Record type created successfully");
        } catch {
            toast.error("Failed to create record type");
            throw new Error("Create failed");
        }
    };

    const handleUpdate = async (id: number, data: EmployeeFileRecordTypeFormData) => {
        try {
            await updateRecord(id, data);
            toast.success("Record type updated successfully");
        } catch {
            toast.error("Failed to update record type");
            throw new Error("Update failed");
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteRecord(id);
            toast.success("Record type deleted successfully");
        } catch {
            toast.error("Failed to delete record type");
            throw new Error("Delete failed");
        }
    };

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                    <span>
                        Failed to load record types:{" "}
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
                        Employee File Record Types
                    </h1>
                    <p className="text-muted-foreground">
                        Manage the categories of employee file records
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <EmployeeFileRecordTypeTable
                data={records}
                isLoading={isLoading}
                onCreateRecord={handleCreate}
                onUpdateRecord={handleUpdate}
                onDeleteRecord={handleDelete}
            />
        </div>
    );
}

// ============================================================================
// MAIN WRAPPER (PROVIDER)
// ============================================================================

export default function EmployeeFileRecordTypeModule() {
    return (
        <EmployeeFileRecordTypeFetchProvider>
            <EmployeeFileRecordTypeFilterProvider>
                <EmployeeFileRecordTypeModuleContent />
            </EmployeeFileRecordTypeFilterProvider>
        </EmployeeFileRecordTypeFetchProvider>
    );
}
