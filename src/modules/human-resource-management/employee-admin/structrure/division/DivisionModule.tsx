/**
 * Division Module
 * Main orchestrator component
 */

"use client";

import React from "react";
import { DivisionFilterProvider } from "./providers/DivisionFilterProvider";
import { useDivisions } from "./hooks/useDivisions";
import { DivisionTable } from "./components/DivisionTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function DivisionModuleContent() {
    const {
        divisions,
        users,
        departments,
        bankAccounts,
        isLoading,
        isError,
        error,
        refetch,
        createDivision,
        updateDivision,
        deleteDivision,
    } = useDivisions();

    const handleCreate = async (data: Record<string, unknown>) => {
        try {
            await createDivision(data);
            toast.success("Division created successfully");
        } catch (error) {
            toast.error("Failed to create division");
            throw error;
        }
    };

    const handleUpdate = async (id: number, data: Record<string, unknown>) => {
        try {
            await updateDivision(id, data);
            toast.success("Division updated successfully");
        } catch (error) {
            toast.error("Failed to update division");
            throw error;
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteDivision(id);
            toast.success("Division deleted successfully");
        } catch (error) {
            toast.error("Failed to delete division");
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
                        Failed to load divisions: {error?.message || "Unknown error"}
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
                    <h1 className="text-3xl font-bold tracking-tight">Divisions</h1>
                    <p className="text-muted-foreground">
                        Manage and view all divisions with their departments
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <DivisionTable
                data={divisions}
                users={users}
                departments={departments}
                bankAccounts={bankAccounts}
                isLoading={isLoading}
                onCreateDivision={handleCreate}
                onUpdateDivision={handleUpdate}
                onDeleteDivision={handleDelete}
            />
        </div>
    );
}

export default function DivisionModule() {
    return (
        <DivisionFilterProvider>
            <DivisionModuleContent />
        </DivisionFilterProvider>
    );
}
