"use client";

import React from "react";
import type { AssessmentFormData } from "./types";
import { AssessmentManagementFilterProvider } from "./providers/filterProvider";
import { AssessmentManagementFetchProvider } from "./providers/fetchProvider";
import { useAssessmentManagement } from "./hooks/useAssessmentManagement";
import { AssessmentManagementTable } from "./components/Table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

function AssessmentManagementModuleContent() {
    const {
        assessments,
        isLoading,
        isError,
        error,
        refetch,
        createAssessment,
        updateAssessment,
        deleteAssessment,
        archiveAssessment,
    } = useAssessmentManagement();

    const handleCreate = async (data: AssessmentFormData) => {
        try {
            await createAssessment(data);
            toast.success("Assessment created successfully");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create assessment");
            throw error;
        }
    };

    const handleUpdate = async (id: number, data: AssessmentFormData) => {
        try {
            await updateAssessment(id, data);
            toast.success("Assessment updated successfully");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update assessment");
            throw error;
        }
    };

    const handleArchive = async (id: number) => {
        try {
            await archiveAssessment(id);
            toast.success("Assessment archived successfully");
        } catch {
            toast.error("Failed to archive assessment");
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteAssessment(id);
            toast.success("Assessment deleted successfully");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete assessment";
            toast.error(message, {
                action: {
                    label: "Archive Instead",
                    onClick: () => handleArchive(id),
                },
            });
            throw new Error("Delete failed");
        }
    };

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                    <span>Failed to load assessments: {error?.message || "Unknown error"}</span>
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-4">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Assessment Management</h1>
                    <p className="text-muted-foreground">
                        Configure assessment settings and policies
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="w-full sm:w-auto">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <AssessmentManagementTable
                data={assessments}
                isLoading={isLoading}
                onCreateAssessment={handleCreate}
                onUpdateAssessment={handleUpdate}
                onDeleteAssessment={handleDelete}
            />
        </div>
    );
}

export default function AssessmentManagementModule() {
    return (
        <AssessmentManagementFetchProvider>
            <AssessmentManagementFilterProvider>
                <AssessmentManagementModuleContent />
            </AssessmentManagementFilterProvider>
        </AssessmentManagementFetchProvider>
    );
}
