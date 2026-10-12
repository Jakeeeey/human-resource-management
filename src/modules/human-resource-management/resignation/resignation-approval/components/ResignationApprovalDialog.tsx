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

interface ResignationApprovalDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (remarks: string) => Promise<void>;
    action: "approve" | "reject" | null;
    employeeName: string;
    isLoading?: boolean;
}

export function ResignationApprovalDialog({
    isOpen,
    onClose,
    onConfirm,
    action,
    employeeName,
    isLoading = false,
}: ResignationApprovalDialogProps) {
    const [remarks, setRemarks] = useState("");

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
                        {action === "approve" ? "Approve" : "Reject"} Resignation Request
                    </DialogTitle>
                    <DialogDescription>
                        {action === "approve"
                            ? `You are about to approve the resignation request for ${employeeName}.`
                            : `You are about to reject the resignation request for ${employeeName}.`
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
                        variant={action === "approve" ? "default" : "destructive"}
                    >
                        {isLoading ? "Processing..." : action === "approve" ? "Approve" : "Reject"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
