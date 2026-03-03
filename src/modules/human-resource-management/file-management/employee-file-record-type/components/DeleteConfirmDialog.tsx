"use client";

import React from "react";
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
import type { EmployeeFileRecordType } from "../types";

interface DeleteConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    record: EmployeeFileRecordType | null;
    onConfirm: () => Promise<void>;
}

export function DeleteConfirmDialog({
    open,
    onOpenChange,
    record,
    onConfirm,
}: DeleteConfirmDialogProps) {
    const [isDeleting, setIsDeleting] = React.useState(false);

    const handleConfirm = async () => {
        try {
            setIsDeleting(true);
            await onConfirm();
            onOpenChange(false);
        } catch (error) {
            console.error("Error deleting record:", error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the record type{" "}
                        <span className="font-semibold">&quot;{record?.name}&quot;</span>. This
                        action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
