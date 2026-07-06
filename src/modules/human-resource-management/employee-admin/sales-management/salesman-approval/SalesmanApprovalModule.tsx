"use client";

import { useState } from "react";
import { useSalesmanApprovalContext } from "./providers/SalesmanApprovalProvider";
import { SalesmanApprovalTable } from "./components/SalesmanApprovalTable";
import { ApprovalActionDialog } from "./components/ApprovalActionDialog";
import { SalesmanApprovalDialog } from "./components/SalesmanApprovalDialog";
import { toast } from "sonner";
import type { SalesmanDraftWithRelations } from "./types";

export function SalesmanApprovalModule() {
    const { 
        drafts, users, divisions, branches, badBranches, operations, priceTypes,
        isLoading, isError, approveDraft, rejectDraft 
    } = useSalesmanApprovalContext();

    const [selectedDraft, setSelectedDraft] = useState<SalesmanDraftWithRelations | null>(null);
    const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
    const [isPending, setIsPending] = useState(false);

    const handleApproveClick = (draft: SalesmanDraftWithRelations) => {
        setSelectedDraft(draft);
        setActionType("approve");
        setIsApprovalDialogOpen(true);
    };

    const handleRejectClick = (draft: SalesmanDraftWithRelations) => {
        setSelectedDraft(draft);
        setActionType("reject");
        setIsRejectDialogOpen(true);
    };

    const handleConfirmAction = async () => {
        if (!selectedDraft || !actionType) return;

        setIsPending(true);
        try {
            if (actionType === "approve") {
                // Now handled by the SalesmanApprovalDialog directly
            } else {
                await rejectDraft(selectedDraft.id);
                toast.success("Salesman draft rejected");
            }
            setIsRejectDialogOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to process action");
        } finally {
            setIsPending(false);
        }
    };

    if (isError) {
        return (
            <div className="flex h-[400px] items-center justify-center text-destructive">
                Failed to load salesman drafts. Please try again.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Salesman Approval</h2>
                    <p className="text-muted-foreground">
                        Review and approve pending salesman drafts.
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex h-[400px] items-center justify-center">
                    <p className="text-muted-foreground">Loading drafts...</p>
                </div>
            ) : (
                <SalesmanApprovalTable
                    drafts={drafts}
                    onApprove={handleApproveClick}
                    onReject={handleRejectClick}
                />
            )}

            <ApprovalActionDialog
                isOpen={isRejectDialogOpen}
                onOpenChange={setIsRejectDialogOpen}
                action={actionType}
                draft={selectedDraft}
                onConfirm={handleConfirmAction}
                isPending={isPending}
            />

            <SalesmanApprovalDialog
                open={isApprovalDialogOpen}
                onOpenChange={setIsApprovalDialogOpen}
                draft={selectedDraft}
                users={users}
                divisions={divisions}
                branches={branches}
                badBranches={badBranches}
                operations={operations}
                priceTypes={priceTypes}
                onSubmit={async (data) => {
                    if (selectedDraft) {
                        await approveDraft(selectedDraft.id, data);
                    }
                }}
            />
        </div>
    );
}
