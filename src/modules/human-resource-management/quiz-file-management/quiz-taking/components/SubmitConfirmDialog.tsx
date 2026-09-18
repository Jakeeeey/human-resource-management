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
import { isAre, pluralize } from "../../utils/pluralize";

interface SubmitConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    unansweredCount: number;
    onConfirm: () => void;
}

/**
 * Confirms the irreversible submit action and names how many questions the
 * applicant is about to leave blank (Nielsen #5 — error prevention).
 */
export function SubmitConfirmDialog({
    open,
    onOpenChange,
    unansweredCount,
    onConfirm,
}: SubmitConfirmDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Submit your answers?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {unansweredCount > 0
                            ? `${unansweredCount} ${pluralize(
                                  unansweredCount,
                                  "question"
                              )} ${isAre(unansweredCount)} unanswered. Unanswered questions are marked wrong, and you can't change your answers after submitting.`
                            : "You've answered every question. You can't change your answers after submitting."}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep answering</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>Submit quiz</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
