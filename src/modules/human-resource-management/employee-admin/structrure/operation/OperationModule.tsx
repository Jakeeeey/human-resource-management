"use client";

import React from "react";
import { OperationFilterProvider } from "./providers/OperationFilterProvider";
import { useOperations } from "./hooks/useOperations";
import { OperationTable } from "./components/OperationTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { OperationFormData } from "./types";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Plus } from "lucide-react";
import { OperationDialog } from "./components/OperationDialog";

function OperationModuleContent() {
    const {
        operations,
        isLoading,
        isError,
        error,
        refetch,
        createOperation,
        updateOperation,
    } = useOperations();

    const [isCreateOpen, setIsCreateOpen] = React.useState(false);

    const handleCreate = async (data: OperationFormData) => {
        try {
            await createOperation(data);
            toast.success("Operation created successfully");
            setIsCreateOpen(false);
        } catch (error) {
            toast.error("Failed to create operation");
            console.error(error);
        }
    };

    const handleUpdate = async (id: number, data: OperationFormData) => {
        try {
            await updateOperation(id, data);
            toast.success("Operation updated successfully");
        } catch (error) {
            toast.error("Failed to update operation");
            console.error(error);
        }
    };


    if (isError) {
        return (
            <Alert variant="destructive" className="rounded-xl border-2 shadow-lg">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle className="text-lg font-bold">Connection Error</AlertTitle>
                <AlertDescription className="mt-2 flex flex-col gap-4">
                    <p className="text-sm opacity-90 leading-relaxed">
                        We encountered an issue while connecting to the database. This might be due to a network interruption or server maintenance.
                        Error: <span className="font-mono font-bold bg-destructive-foreground/10 px-1 rounded">{error?.message || "Unknown error"}</span>
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        className="w-fit font-bold border-2 hover:bg-destructive hover:text-white transition-all"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reconnect Now
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex flex-col gap-8 h-full min-h-0 animate-in fade-in duration-700">
            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pt-0 flex flex-row items-end justify-between gap-4 pb-0">
                    <div className="space-y-1.5 min-w-0">
                        <CardTitle className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60 leading-tight">
                            Operations
                        </CardTitle>
                        <CardDescription className="text-base text-muted-foreground font-medium leading-relaxed max-w-2xl truncate">
                            Manage and orchestrate all system operations with precision and ease.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => refetch()}
                            className="bg-background hover:bg-muted font-bold transition-all border-2 rounded-xl h-11 w-11 shadow-sm"
                            title="Refresh data"
                        >
                            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            onClick={() => setIsCreateOpen(true)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-11 rounded-xl shadow-md transition-all hover:translate-y-[-1px] active:translate-y-0"
                        >
                            <Plus className="mr-2 h-5 w-5 stroke-[3px]" />
                            Add New Operation
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <div className="min-h-0 flex-1">
                <OperationTable
                    data={operations}
                    isLoading={isLoading}
                    onUpdate={handleUpdate}
                />
            </div>

            <OperationDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSubmit={handleCreate}
                existingOperations={operations}
            />
        </div>
    );
}

export default function OperationModule() {
    return (
        <OperationFilterProvider>
            <OperationModuleContent />
        </OperationFilterProvider>
    );
}
