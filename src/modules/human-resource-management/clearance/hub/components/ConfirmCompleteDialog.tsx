"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConfirmCompleteDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    employeeName: string;
    templateTitle: string;
    unissuedDocuments?: string[];
    isConfirming?: boolean;
    onCloseAutoFocus?: (event: Event) => void;
}

export function ConfirmCompleteDialog({
    isOpen,
    onClose,
    onConfirm,
    employeeName,
    templateTitle,
    unissuedDocuments = [],
    isConfirming = false,
    onCloseAutoFocus,
}: ConfirmCompleteDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent
                className="sm:max-w-125 data-[state=closed]:duration-100 data-[state=open]:duration-150"
                onCloseAutoFocus={onCloseAutoFocus}
            >
                <DialogHeader>
                    <DialogTitle>Confirm Clearance Complete</DialogTitle>
                    <DialogDescription>
                        {employeeName} · {templateTitle}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {unissuedDocuments.length > 0 ? (
                        <Alert>
                            <AlertDescription>
                                Still needed for full completion: {unissuedDocuments.join(", ")}. Full
                                completion needs the Clearance Form, SOA, and Quit Claims all issued.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Alert>
                            <AlertDescription>
                                All three documents are issued. Confirming closes this clearance as complete and makes
                                the record read-only.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={isConfirming}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={onConfirm} disabled={isConfirming}>
                        {isConfirming ? "Confirming..." : "Confirm Complete"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
