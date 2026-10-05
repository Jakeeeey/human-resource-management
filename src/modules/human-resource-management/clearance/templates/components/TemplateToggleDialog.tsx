"use client";

import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import type { ClearanceTemplate } from "../types";

export interface TemplateToggleDialogProps {
    open: boolean;
    template: ClearanceTemplate | null;
    busy: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export function TemplateToggleDialog(props: TemplateToggleDialogProps): JSX.Element {
    const { open, template, busy, onClose, onConfirm } = props;
    const deactivating = template?.is_active ?? true;

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto rounded-2xl data-[state=closed]:duration-100 data-[state=open]:duration-150 sm:max-w-[480px]">
                {open && template !== null && (
                    <>
                        <DialogHeader>
                            <DialogTitle>
                                {deactivating ? "Deactivate template" : "Reactivate template"}
                            </DialogTitle>
                            <DialogDescription>
                                {deactivating
                                    ? `“${template.title}” will be hidden from assignment and leave the active registry. Its categories and signer pools are kept, and you can reactivate it at any time.`
                                    : `“${template.title}” will return to the active registry and become available for assignment again.`}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex-col gap-2 sm:flex-row">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                disabled={busy}
                                className="w-full sm:w-auto"
                            >
                                Cancel
                            </Button>
                            <Button
                                variant={deactivating ? "destructive" : "default"}
                                onClick={onConfirm}
                                disabled={busy}
                                className="w-full sm:w-auto"
                            >
                                {busy ? "Saving…" : deactivating ? "Deactivate" : "Reactivate"}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
