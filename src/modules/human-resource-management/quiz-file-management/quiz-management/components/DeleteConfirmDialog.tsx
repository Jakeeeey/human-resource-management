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
import type { Quiz } from "../types";

interface DeleteConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    quiz: Quiz | null;
    onConfirm: () => Promise<void>;
}

export function DeleteConfirmDialog({
    open,
    onOpenChange,
    quiz,
    onConfirm,
}: DeleteConfirmDialogProps) {
    const [isDeleting, setIsDeleting] = React.useState(false);

    const handleConfirm = async () => {
        try {
            setIsDeleting(true);
            await onConfirm();
            onOpenChange(false);
        } catch (error) {
            console.error("Error deleting quiz:", error);
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
                        This permanently deletes the quiz{" "}
                        <span className="font-semibold">&quot;{quiz?.name}&quot;</span> --
                        but only if it has no recorded attempts. If it does, deletion will
                        be blocked and you&apos;ll be offered the option to archive it
                        instead, which keeps it out of use without losing that history.
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
