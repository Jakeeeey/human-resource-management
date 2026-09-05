"use client";

import React from "react";
import type { TemplateFormData } from "./types";
import { TemplateFilterProvider } from "./providers/filterProvider";
import { TemplateFetchProvider } from "./providers/fetchProvider";
import { useInterviewCriteriaTemplates } from "./hooks/useInterviewCriteriaTemplates";
import { TemplateTable } from "./components/Table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

function InterviewCriteriaTemplatesModuleContent() {
    const {
        templates,
        isLoading,
        isError,
        error,
        refetch,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        archiveTemplate,
    } = useInterviewCriteriaTemplates();

    const handleCreate = async (data: TemplateFormData) => {
        try {
            await createTemplate(data);
            toast.success("Template created successfully");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create template");
            throw error;
        }
    };

    const handleUpdate = async (id: number, data: TemplateFormData) => {
        try {
            await updateTemplate(id, data);
            toast.success("Template updated successfully");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update template");
            throw error;
        }
    };

    const handleArchive = async (id: number) => {
        try {
            await archiveTemplate(id);
            toast.success("Template archived successfully");
        } catch {
            toast.error("Failed to archive template");
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteTemplate(id);
            toast.success("Template deleted successfully");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete template";
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
                    <span>Failed to load templates: {error?.message || "Unknown error"}</span>
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
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Interview Criteria Templates</h1>
                    <p className="text-muted-foreground">
                        Configure the weighted rubric used to score Initial and Final interviews.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="w-full sm:w-auto">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <TemplateTable
                data={templates}
                isLoading={isLoading}
                onCreateTemplate={handleCreate}
                onUpdateTemplate={handleUpdate}
                onDeleteTemplate={handleDelete}
            />
        </div>
    );
}

export default function InterviewCriteriaTemplatesModule() {
    return (
        <TemplateFetchProvider>
            <TemplateFilterProvider>
                <InterviewCriteriaTemplatesModuleContent />
            </TemplateFilterProvider>
        </TemplateFetchProvider>
    );
}
