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

interface MsConfirmDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly busy?: boolean;
    readonly busyLabel?: string;
    readonly onConfirm: () => void;
}

/**
 * Studio destructive confirm — Radix AlertDialog with a red confirm action
 * per QA §1.5. Replaces window.confirm for retire/unhook flows; the copy
 * names the blast radius so the dialog cannot be habitually dismissed.
 */
export function MsConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    busy = false,
    busyLabel,
    onConfirm,
}: MsConfirmDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
                        disabled={busy}
                        onClick={onConfirm}
                    >
                        {busy && busyLabel ? busyLabel : confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
