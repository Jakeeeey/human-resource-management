"use client";

import React, { useState, useCallback } from "react";
import { DataTable } from "@/components/ui/new-data-table";
import { createColumns } from "./columns";
import type { IndustryWithRelations, IndustryFormData } from "../types";
import { useIndustryFilters } from "../hooks/useIndustryFilters";
import { IndustryDialog } from "./IndustryDialog";

interface IndustryTableProps {
    data: IndustryWithRelations[];
    isLoading?: boolean;
    onUpdate: (id: number, data: IndustryFormData) => Promise<void>;
}

export function IndustryTable({
    data,
    isLoading = false,
    onUpdate,
}: IndustryTableProps) {
    const { setSearch } = useIndustryFilters();
    const [selectedIndustry, setSelectedIndustry] = useState<IndustryWithRelations | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [viewDialogOpen, setViewDialogOpen] = useState(false);

    const handleEdit = useCallback((industry: IndustryWithRelations) => {
        setSelectedIndustry(industry);
        setEditDialogOpen(true);
    }, []);

    const handleView = useCallback((industry: IndustryWithRelations) => {
        setSelectedIndustry(industry);
        setViewDialogOpen(true);
    }, []);

    const columns = React.useMemo(() => createColumns(handleEdit, handleView), [handleEdit, handleView]);

    return (
        <div className="space-y-4 h-full flex flex-col min-h-0 industry-table-wrapper">
            <style dangerouslySetInnerHTML={{ __html: `
                .industry-table-wrapper .ml-auto > button:last-child {
                    display: none !important;
                }
                .industry-table-wrapper > div:first-child {
                    padding-top: 1.5rem !important;
                    padding-bottom: 0.5rem !important;
                }
            `}} />
            <DataTable
                columns={columns}
                data={data}
                isLoading={isLoading}
                searchKey="name_code_or_head"
                onSearch={setSearch}
                emptyTitle="No Industries Registered"
                emptyDescription="Start by adding your first industry registration."
            />

            <IndustryDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                industry={selectedIndustry}
                existingIndustries={data}
                onSubmit={async (data) => {
                    try {
                        if (selectedIndustry) {
                            await onUpdate(selectedIndustry.id, data);
                            setEditDialogOpen(false);
                            setSelectedIndustry(null);
                        }
                    } catch (error: unknown) {
                        console.error("Industry submission failed:", error);
                    } finally {
                        // Handle finalization if needed
                    }
                }}
            />

            <IndustryDialog
                open={viewDialogOpen}
                onOpenChange={(open) => {
                    setViewDialogOpen(open);
                    if (!open) setSelectedIndustry(null);
                }}
                industry={selectedIndustry}
                readOnly={true}
                onSubmit={async () => {}}
            />
        </div>
    );
}
