"use client";

import React from "react";
import type { QuizQuestionFormData } from "./types";
import { FileManagementFilterProvider } from "./providers/filterProvider";
import { FileManagementFetchProvider } from "./providers/fetchProvider";
import { useFileManagement } from "./hooks/useFileManagement";
import { FileManagementTable } from "./components/Table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

function FileManagementModuleContent() {
    const {
        questions,
        isLoading,
        isError,
        error,
        refetch,
        createQuestion,
        updateQuestion,
        deleteQuestion,
        reactivateQuestion,
    } = useFileManagement();

    const handleCreate = async (data: QuizQuestionFormData) => {
        try {
            await createQuestion(data);
            toast.success("Question created successfully");
        } catch {
            toast.error("Failed to create question");
            throw new Error("Create failed");
        }
    };

    const handleUpdate = async (id: number, data: QuizQuestionFormData) => {
        try {
            await updateQuestion(id, data);
            toast.success("Question updated successfully");
        } catch {
            toast.error("Failed to update question");
            throw new Error("Update failed");
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteQuestion(id);
            toast.success("Question deactivated successfully");
        } catch {
            toast.error("Failed to deactivate question");
            throw new Error("Delete failed");
        }
    };

    const handleReactivate = async (id: number) => {
        try {
            await reactivateQuestion(id);
            toast.success("Question reactivated successfully");
        } catch {
            toast.error("Failed to reactivate question");
            throw new Error("Reactivate failed");
        }
    };

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                    <span>Failed to load questions: {error?.message || "Unknown error"}</span>
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
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Question Pool</h1>
                    <p className="text-muted-foreground">
                        Manage the shared pool of quiz questions
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="w-full sm:w-auto">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <FileManagementTable
                data={questions}
                isLoading={isLoading}
                onCreateQuestion={handleCreate}
                onUpdateQuestion={handleUpdate}
                onDeleteQuestion={handleDelete}
                onReactivateQuestion={handleReactivate}
            />
        </div>
    );
}

export default function FileManagementModule() {
    return (
        <FileManagementFetchProvider>
            <FileManagementFilterProvider>
                <FileManagementModuleContent />
            </FileManagementFilterProvider>
        </FileManagementFetchProvider>
    );
}
