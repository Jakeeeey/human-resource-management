/**
 * Department Accounts Module
 * Main orchestrator component
 */

"use client";

import React, { useState, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
    useDepartmentAccountsMasterData,
    useAssignedAccounts,
    useAssignAccounts,
    useUnassignAccount,
} from "./hooks/useDepartmentAccounts";
import { DivisionSelector } from "./components/DivisionSelector";
import { DepartmentSelector } from "./components/DepartmentSelector";
import { AccountsTransferList } from "./components/AccountsTransferList";
import { getDepartmentsForDivision } from "./types";

export default function DepartmentAccountsModule() {
    const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
    const [selectedDeptDivId, setSelectedDeptDivId] = useState<number | null>(null);

    // Fetch master data
    const {
        data: masterData,
        isLoading: isMasterLoading,
        isError: isMasterError,
        error: masterError,
        refetch: refetchMaster,
    } = useDepartmentAccountsMasterData();

    // Fetch assigned accounts for selected department
    const {
        data: accountsData,
        isLoading: isAccountsLoading,
        refetch: refetchAccounts,
    } = useAssignedAccounts(selectedDeptDivId);

    // Mutations with refetch callback
    const assignMutation = useAssignAccounts(() => {
        refetchAccounts();
    });

    const unassignMutation = useUnassignAccount(() => {
        refetchAccounts();
    });

    // Get selected division data
    const selectedDivision = useMemo(() => {
        if (!masterData || !selectedDivisionId) return undefined;
        return masterData.divisions.find(
            (div) => div.division_id === selectedDivisionId
        );
    }, [masterData, selectedDivisionId]);

    // Get departments for selected division
    const departmentsForDivision = useMemo(() => {
        return getDepartmentsForDivision(selectedDivision);
    }, [selectedDivision]);

    // Handlers
    const handleDivisionChange = (divisionId: number | null) => {
        setSelectedDivisionId(divisionId);
        setSelectedDeptDivId(null); // Reset department selection
    };

    const handleDepartmentChange = (deptDivId: number | null) => {
        setSelectedDeptDivId(deptDivId);
    };

    const handleAssignAccount = async (coaId: number) => {
        if (!selectedDeptDivId) return;

        try {
            await assignMutation.mutateAsync({
                dept_div_id: selectedDeptDivId,
                coa_ids: [coaId],
            });
            toast.success("Account assigned successfully");
        } catch (error) {
            toast.error("Failed to assign account");
            console.error(error);
        }
    };

    const handleUnassignAccount = async (coaId: number) => {
        if (!selectedDeptDivId) return;

        try {
            await unassignMutation.mutateAsync({
                dept_div_id: selectedDeptDivId,
                coa_id: coaId,
            });
            toast.success("Account removed successfully");
        } catch (error) {
            toast.error("Failed to remove account");
            console.error(error);
        }
    };

    const handleRefresh = () => {
        refetchMaster();
        if (selectedDeptDivId) {
            refetchAccounts();
        }
    };

    // Error state
    if (isMasterError) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                    <span>
                        Failed to load data: {masterError?.message || "Unknown error"}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        className="ml-4"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    // Loading state
    if (isMasterLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-4 w-96" />
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                </div>
                <Skeleton className="h-[600px]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Department Accounts
                    </h1>
                    <p className="text-muted-foreground">
                        Assign chart of accounts to departments within divisions
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Selectors */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <DivisionSelector
                            divisions={masterData?.divisions || []}
                            selectedDivisionId={selectedDivisionId}
                            onSelectDivision={handleDivisionChange}
                        />
                        <DepartmentSelector
                            departments={departmentsForDivision}
                            selectedDeptDivId={selectedDeptDivId}
                            onSelectDepartment={handleDepartmentChange}
                            disabled={!selectedDivisionId}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Accounts Transfer List */}
            {selectedDeptDivId ? (
                isAccountsLoading ? (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <Skeleton className="h-[600px]" />
                        <Skeleton className="h-[600px]" />
                    </div>
                ) : accountsData ? (
                    <AccountsTransferList
                        assignedAccounts={accountsData.assigned}
                        availableAccounts={accountsData.available}
                        onAssignAccount={handleAssignAccount}
                        onUnassignAccount={handleUnassignAccount}
                        isAssigning={assignMutation.isPending}
                        isUnassigning={unassignMutation.isPending}
                    />
                ) : null
            ) : (
                <Card>
                    <CardContent className="flex h-[400px] items-center justify-center">
                        <div className="text-center text-muted-foreground">
                            <p className="text-lg font-medium">
                                Select a division and department to manage accounts
                            </p>
                            <p className="text-sm">
                                Choose from the dropdowns above to get started
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
