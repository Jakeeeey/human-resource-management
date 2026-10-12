"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { createMsSuppression } from "../providers/msSuppressionsClient";
import { SUPPRESSION_REASONS, SUPPRESSION_REASON_LABELS, type SuppressionReason } from "../types";

interface SuppressionDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly existingEmails: readonly string[];
    readonly onDuplicate: (email: string) => void;
    readonly onSaved: () => void;
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function SuppressionDialog({ open, onOpenChange, existingEmails, onDuplicate, onSaved }: SuppressionDialogProps) {
    const [email, setEmail] = useState("");
    const [reason, setReason] = useState<SuppressionReason>("manual");
    const [note, setNote] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        setEmail("");
        setReason("manual");
        setNote("");
        setFormError(null);
        setBusy(false);
    }, [open]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        setFormError(null);
        const normalized = email.trim().toLowerCase();
        if (!EMAIL_PATTERN.test(normalized)) {
            setFormError("Enter a valid email address.");
            return;
        }
        if (existingEmails.includes(normalized)) {
            onDuplicate(normalized);
            onOpenChange(false);
            return;
        }
        setBusy(true);
        try {
            const trimmedNote = note.trim();
            await createMsSuppression({
                email: normalized,
                reason,
                ...(trimmedNote.length > 0 ? { note: trimmedNote } : {}),
            });
            onSaved();
            onOpenChange(false);
        } catch (cause) {
            setFormError(cause instanceof Error ? cause.message : String(cause));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[520px]">
                <DialogHeader className="px-6 pt-6 text-left">
                    <DialogTitle>Add suppression</DialogTitle>
                    <DialogDescription>
                        Suppressed addresses are held back from every studio send. Adding an address that is already
                        suppressed keeps the existing entry — nothing breaks.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="flex min-h-0 flex-1 flex-col overflow-hidden"
                    data-testid="suppression-form"
                    onSubmit={(event) => void handleSubmit(event)}
                >
                    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="suppression-email">
                                Email <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                className="h-8 text-xs"
                                id="suppression-email"
                                placeholder="do-not-mail@example.com"
                                spellCheck={false}
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="suppression-reason">
                                Reason
                            </Label>
                            <Select value={reason} onValueChange={(next) => setReason(next as SuppressionReason)}>
                                <SelectTrigger className="h-8 text-xs" id="suppression-reason" size="sm">
                                    <SelectValue placeholder="Reason" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {SUPPRESSION_REASONS.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {SUPPRESSION_REASON_LABELS[option]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="suppression-note">
                                Note
                            </Label>
                            <Input
                                className="h-8 text-xs"
                                id="suppression-note"
                                placeholder="Why this address is suppressed"
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                            />
                        </div>
                        {formError ? (
                            <p className="text-xs text-destructive" role="alert">
                                {formError}
                            </p>
                        ) : null}
                    </div>
                    <DialogFooter className="flex-row justify-end border-t bg-muted/20 px-6 py-4">
                        <DialogClose asChild>
                            <Button className="min-h-11 md:min-h-0" disabled={busy} size="sm" type="button" variant="outline">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button className="min-h-11 md:min-h-0" disabled={busy} size="sm" type="submit">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {busy ? "Adding" : "Add suppression"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
