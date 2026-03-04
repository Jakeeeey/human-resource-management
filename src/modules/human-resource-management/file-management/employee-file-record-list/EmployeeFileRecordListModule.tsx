"use client";

import React from "react";
import type { EmployeeFileRecordListFormData } from "./types";
import { EmployeeFileRecordListFilterProvider } from "./providers/filterProvider";
import { EmployeeFileRecordListFetchProvider } from "./providers/fetchProvider";
import { useEmployeeFileRecordList } from "./hooks/useEmployeeFileRecordList";
import { EmployeeFileRecordListTable } from "./components/EmployeeFileRecordListTable";
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

function EmployeeFileRecordListModuleContent() {
    const {
        records,
        recordTypes,
        isLoading,
        isError,
        error,
        refetch,
        createRecord,
        updateRecord,
        deleteRecord,
    } = useEmployeeFileRecordList();

    const handleCreate = async (data: EmployeeFileRecordListFormData) => {
        try {
            await createRecord(data);
            toast.success("Record created successfully");
        } catch {
            toast.error("Failed to create record");
            throw new Error("Create failed");
        }
    };

    const handleUpdate = async (id: number, data: EmployeeFileRecordListFormData) => {
        try {
            await updateRecord(id, data);
            toast.success("Record updated successfully");
        } catch {
            toast.error("Failed to update record");
            throw new Error("Update failed");
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteRecord(id);
            toast.success("Record deleted successfully");
        } catch {
            toast.error("Failed to delete record");
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
                        Failed to load records:{" "}
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
                        Employee File Record List
                    </h1>
                    <p className="text-muted-foreground">
                        Manage employee file records by type
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <EmployeeFileRecordListTable
                data={records}
                recordTypes={recordTypes}
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

export default function EmployeeFileRecordListModule() {
    return (
        <EmployeeFileRecordListFetchProvider>
            <EmployeeFileRecordListFilterProvider>
                <EmployeeFileRecordListModuleContent />
            </EmployeeFileRecordListFilterProvider>
        </EmployeeFileRecordListFetchProvider>
    );
}
