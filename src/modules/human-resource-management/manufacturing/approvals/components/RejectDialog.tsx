"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert } from "lucide-react";

interface RejectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (reason: string) => Promise<void>;
}

export function RejectDialog({ open, onOpenChange, onConfirm }: RejectDialogProps) {
    const [reason, setReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        if (!reason.trim()) return;
        setIsSubmitting(true);
        try {
            await onConfirm(reason);
            setReason("");
            onOpenChange(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border shadow-2xl">
                <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
                    <div className="flex items-center gap-4">
                        <div className="bg-destructive/10 p-3 rounded-2xl shadow-inner ring-1 ring-destructive/20">
                            <ShieldAlert className="h-6 w-6 text-destructive" />
                        </div>
                        <div className="space-y-0.5">
                            <DialogTitle className="text-xl font-black tracking-tighter text-foreground leading-none">
                                Reject Schedule
                            </DialogTitle>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                                Provide Rejection Reason
                            </p>
                        </div>
                    </div>
                </DialogHeader>
                <div className="p-6">
                    <Textarea
                        placeholder="Explain why this schedule deviation is being rejected..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="min-h-[120px] rounded-xl resize-none font-medium text-sm"
                    />
                </div>
                <DialogFooter className="p-6 py-4 border-t bg-muted/10 flex items-center justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                        className="rounded-xl px-8 font-black h-10 text-[10px] uppercase"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={isSubmitting || !reason.trim()}
                        className="rounded-xl px-8 font-black h-10 text-[10px] uppercase shadow-lg shadow-destructive/20"
                    >
                        {isSubmitting ? "Rejecting..." : "Confirm Rejection"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
