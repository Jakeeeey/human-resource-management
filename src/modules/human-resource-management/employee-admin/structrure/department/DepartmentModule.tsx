/**
 * Department Module
 * Table + CRUD only (no charts / summary cards)
 */

"use client";

import React from "react";
import { DepartmentFilterProvider } from "./providers/DepartmentFilterProvider";
import { useDepartments } from "./hooks/userDepartments";
import { DepartmentTable } from "./components/DepartmentTable";

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

function DepartmentModuleContent() {
    const {
        departments,
        divisions,
        users,
        isLoading,
        isError,
        error,
        refetch,
        createDepartment,
        updateDepartment,
        deleteDepartment,
    } = useDepartments();

    // ------------------------------------------------------------------------
    // CRUD HANDLERS WITH SONNER TOAST
    // ------------------------------------------------------------------------

    const handleCreate = async (data: Record<string, unknown>) => {
        try {
            await createDepartment(data);
            toast.success("Department created successfully");
        } catch (err) {
            toast.error("Failed to create department");
            throw err;
        }
    };

    const handleUpdate = async (id: number, data: Record<string, unknown>) => {
        try {
            await updateDepartment(id, data);
            toast.success("Department updated successfully");
        } catch (err) {
            toast.error("Failed to update department");
            throw err;
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteDepartment(id);
            toast.success("Department deleted successfully");
        } catch (err) {
            toast.error("Failed to delete department");
            throw err;
        }
    };

    // ------------------------------------------------------------------------
    // ERROR STATE
    // ------------------------------------------------------------------------

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                    <span>
                        Failed to load departments:{" "}
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

    // ------------------------------------------------------------------------
    // RENDER
    // ------------------------------------------------------------------------

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Departments
                    </h1>
                    <p className="text-muted-foreground">
                        Manage and view all departments across divisions
                    </p>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Table */}
            <DepartmentTable
                data={departments}
                divisions={divisions}
                users={users}
                isLoading={isLoading}
                onCreateDepartment={handleCreate}
                onUpdateDepartment={handleUpdate}
                onDeleteDepartment={handleDelete}
            />
        </div>
    );
}

// ============================================================================
// MAIN WRAPPER (PROVIDER)
// ============================================================================

export default function DepartmentModule() {
    return (
        <DepartmentFilterProvider>
            <DepartmentModuleContent />
        </DepartmentFilterProvider>
    );
}
