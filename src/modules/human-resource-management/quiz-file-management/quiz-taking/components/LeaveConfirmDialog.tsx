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

interface LeaveConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}

/** Confirms abandoning an in-progress attempt before in-app navigation. */
export function LeaveConfirmDialog({ open, onOpenChange, onConfirm }: LeaveConfirmDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>End this quiz attempt?</AlertDialogTitle>
                    <AlertDialogDescription>
                        The applicant&apos;s answers so far won&apos;t be saved.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep taking</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={onConfirm}>
                        End attempt
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
