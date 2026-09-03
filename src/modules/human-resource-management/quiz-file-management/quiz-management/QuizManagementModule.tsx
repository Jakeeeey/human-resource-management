"use client";

import React from "react";
import type { QuizFormData } from "./types";
import { QuizManagementFilterProvider } from "./providers/filterProvider";
import { QuizManagementFetchProvider } from "./providers/fetchProvider";
import { useQuizManagement } from "./hooks/useQuizManagement";
import { QuizManagementTable } from "./components/Table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

function QuizManagementModuleContent() {
    const {
        quizzes,
        isLoading,
        isError,
        error,
        refetch,
        createQuiz,
        updateQuiz,
        deleteQuiz,
        archiveQuiz,
    } = useQuizManagement();

    const handleCreate = async (data: QuizFormData) => {
        try {
            await createQuiz(data);
            toast.success("Quiz created successfully");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create quiz");
            throw error;
        }
    };

    const handleUpdate = async (id: number, data: QuizFormData) => {
        try {
            await updateQuiz(id, data);
            toast.success("Quiz updated successfully");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update quiz");
            throw error;
        }
    };

    const handleArchive = async (id: number) => {
        try {
            await archiveQuiz(id);
            toast.success("Quiz archived successfully");
        } catch {
            toast.error("Failed to archive quiz");
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteQuiz(id);
            toast.success("Quiz deleted successfully");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to delete quiz";
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
                    <span>Failed to load quizzes: {error?.message || "Unknown error"}</span>
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Quiz Management</h1>
                    <p className="text-muted-foreground">
                        Configure quiz settings and policies
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <QuizManagementTable
                data={quizzes}
                isLoading={isLoading}
                onCreateQuiz={handleCreate}
                onUpdateQuiz={handleUpdate}
                onDeleteQuiz={handleDelete}
            />
        </div>
    );
}

export default function QuizManagementModule() {
    return (
        <QuizManagementFetchProvider>
            <QuizManagementFilterProvider>
                <QuizManagementModuleContent />
            </QuizManagementFilterProvider>
        </QuizManagementFetchProvider>
    );
}
