"use client";

import React from "react";
import type { OperationWithRelations, OperationFormData } from "../types";
import { createColumns } from "./columns";
import { OperationDialog } from "./OperationDialog";
import { DataTable } from "@/components/ui/new-data-table";
import { useOperationFilters } from "../hooks/useOperationFilters";

interface OperationTableProps {
    data: OperationWithRelations[];
    isLoading?: boolean;
    onUpdate: (id: number, data: OperationFormData) => Promise<void>;
}

export function OperationTable({
    data,
    isLoading = false,
    onUpdate,
}: OperationTableProps) {
    const { setSearch } = useOperationFilters();
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [viewDialogOpen, setViewDialogOpen] = React.useState(false);
    const [selectedOperation, setSelectedOperation] = React.useState<OperationWithRelations | null>(null);

    const handleEdit = React.useCallback((operation: OperationWithRelations) => {
        setSelectedOperation(operation);
        setEditDialogOpen(true);
    }, []);

    const handleView = React.useCallback((operation: OperationWithRelations) => {
        setSelectedOperation(operation);
        setViewDialogOpen(true);
    }, []);

    const columns = React.useMemo(() => createColumns(handleEdit, handleView), [handleEdit, handleView]);

    return (
        <div className="space-y-4 h-full flex flex-col min-h-0 operation-table-wrapper">
            <style dangerouslySetInnerHTML={{ __html: `
                .operation-table-wrapper .ml-auto > button:last-child {
                    display: none !important;
                }
            `}} />
            <DataTable
                columns={columns}
                data={data}
                isLoading={isLoading}
                searchKey="name_or_code"
                onSearch={setSearch}
                emptyTitle="No Operations Found"
                emptyDescription="Start by adding your first operation to the system."
            />

            <OperationDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                operation={selectedOperation}
                existingOperations={data}
                onSubmit={async (data) => {
                    if (selectedOperation) {
                        await onUpdate(selectedOperation.id, data);
                        setEditDialogOpen(false);
                        setSelectedOperation(null);
                    }
                }}
            />

            <OperationDialog
                open={viewDialogOpen}
                onOpenChange={(open) => {
                    setViewDialogOpen(open);
                    if (!open) setSelectedOperation(null);
                }}
                operation={selectedOperation}
                readOnly={true}
                onSubmit={async () => {}}
            />
        </div>
    );
}
