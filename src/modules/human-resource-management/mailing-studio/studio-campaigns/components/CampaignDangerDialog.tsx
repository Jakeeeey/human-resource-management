"use client";

import { Loader2 } from "lucide-react";

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

interface CampaignDangerDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly busy: boolean;
    readonly busyLabel: string;
    readonly onConfirm: () => void;
}

export function CampaignDangerDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    busy,
    busyLabel,
    onConfirm,
}: CampaignDangerDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="min-h-11 md:min-h-0" disabled={busy}>
                        Keep it
                    </AlertDialogCancel>
                    <AlertDialogAction
                        className="min-h-11 bg-red-600 hover:bg-red-700 focus-visible:ring-red-600 md:min-h-0"
                        disabled={busy}
                        onClick={onConfirm}
                    >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {busy ? busyLabel : confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
