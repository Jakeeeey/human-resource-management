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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { REMARKS_MAX_LENGTH } from "../types";

interface ResignationAcknowledgementDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (remarks: string) => Promise<void>;
    action: "acknowledge" | "withdraw" | null;
    employeeName: string;
    isLoading?: boolean;
}

export function ResignationAcknowledgementDialog({
    isOpen,
    onClose,
    onConfirm,
    action,
    employeeName,
    isLoading = false,
}: ResignationAcknowledgementDialogProps) {
    const [remarks, setRemarks] = useState("");

    const isAcknowledge = action === "acknowledge";

    const handleConfirm = async (): Promise<void> => {
        try {
            await onConfirm(remarks.trim());
            setRemarks("");
        } catch {
            return;
        }
    };

    const handleClose = () => {
        setRemarks("");
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-125">
                <DialogHeader>
                    <DialogTitle>
                        {isAcknowledge ? "Acknowledge" : "Withdraw"} Resignation Request
                    </DialogTitle>
                    <DialogDescription>
                        {isAcknowledge
                            ? `You are about to acknowledge the resignation request for ${employeeName}. This records that the resignation notice has been received.`
                            : `You are about to mark the resignation request for ${employeeName} as withdrawn. Use this when the employee decides to withdraw their resignation.`
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="remarks">
                            Remarks <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="remarks"
                            placeholder="Enter your remarks here..."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            rows={4}
                            maxLength={REMARKS_MAX_LENGTH}
                            disabled={isLoading}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isLoading || remarks.trim().length === 0}
                        variant={isAcknowledge ? "default" : "secondary"}
                    >
                        {isLoading ? "Processing..." : isAcknowledge ? "Acknowledge" : "Withdraw"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
