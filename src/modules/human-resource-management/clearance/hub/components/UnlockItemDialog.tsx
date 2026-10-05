"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UnlockItemDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => Promise<void>;
    itemLabel: string;
    isUnlocking?: boolean;
}

export function UnlockItemDialog({
    isOpen,
    onClose,
    onConfirm,
    itemLabel,
    isUnlocking = false,
}: UnlockItemDialogProps) {
    const [reason, setReason] = useState("");
    const [formError, setFormError] = useState<string | null>(null);

    const handleRequestClose = () => {
        setReason("");
        setFormError(null);
        onClose();
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            handleRequestClose();
        }
    };

    const handleConfirm = async () => {
        if (reason.trim() === "") {
            setFormError("A reason is required to unlock a signed category");
            return;
        }
        setFormError(null);
        await onConfirm(reason.trim());
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-125 data-[state=closed]:duration-100 data-[state=open]:duration-150">
                <DialogHeader>
                    <DialogTitle>Unlock Signed Category</DialogTitle>
                    <DialogDescription>
                        {itemLabel} — unlocking clears the signature so it can be collected again
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="clearance-unlock-reason">
                            Reason <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="clearance-unlock-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            disabled={isUnlocking}
                            rows={4}
                            placeholder="Explain why this signature must be collected again..."
                        />
                    </div>

                    {formError && (
                        <Alert variant="destructive">
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleRequestClose} disabled={isUnlocking}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isUnlocking || reason.trim() === ""}
                    >
                        {isUnlocking ? "Unlocking..." : "Unlock"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
