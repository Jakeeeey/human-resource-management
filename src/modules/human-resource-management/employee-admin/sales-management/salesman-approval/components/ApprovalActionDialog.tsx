"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { SalesmanDraftWithRelations } from "../types";

interface ApprovalActionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    action: "approve" | "reject" | null;
    draft: SalesmanDraftWithRelations | null;
    onConfirm: () => void;
    isPending: boolean;
}

export function ApprovalActionDialog({
    isOpen,
    onOpenChange,
    action,
    draft,
    onConfirm,
    isPending,
}: ApprovalActionDialogProps) {
    if (!draft || !action) return null;

    const isApprove = action === "approve";

    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {isApprove ? "Approve Salesman Draft" : "Reject Salesman Draft"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {isApprove
                            ? `Are you sure you want to approve the draft for ${draft.salesman_name}? This will create a new active salesman.`
                            : `Are you sure you want to reject and delete the draft for ${draft.salesman_name}? This action cannot be undone.`}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                        }}
                        disabled={isPending}
                        className={isApprove ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90"}
                    >
                        {isPending ? "Processing..." : isApprove ? "Approve" : "Reject"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
