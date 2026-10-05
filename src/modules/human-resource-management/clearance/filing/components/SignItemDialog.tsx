"use client";

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FilingCandidate, FilingItem, SignItemInput } from "../providers/clearanceFilingClient";
import { serializeInk } from "../utils/signingStrokes";
import { SignaturePad, type ClearanceSignaturePadHandle } from "./SignaturePad";
import { SignerCombobox } from "./SignerCombobox";

interface SignItemDialogProps {
    item: FilingItem | null;
    expectedName: string | null;
    candidates: FilingCandidate[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (input: SignItemInput) => Promise<void>;
}

export function SignItemDialog({
    item,
    expectedName,
    candidates,
    open,
    onOpenChange,
    onConfirm,
}: SignItemDialogProps): JSX.Element {
    const padRef = useRef<ClearanceSignaturePadHandle | null>(null);
    const [signerId, setSignerId] = useState<string>("");
    const [reason, setReason] = useState("");
    const [remarks, setRemarks] = useState("");
    const [hasInk, setHasInk] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && item) {
            setSignerId(item.expected_signer_user_id !== null ? String(item.expected_signer_user_id) : "");
            setReason("");
            setRemarks("");
            setHasInk(false);
            setBusy(false);
            setError(null);
            padRef.current?.clear();
        }
    }, [open, item]);

    if (!item) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Collect signature</DialogTitle>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        );
    }

    const signerNumber = signerId === "" ? null : Number(signerId);
    const differs = signerNumber !== null && signerNumber !== item.expected_signer_user_id;

    async function handleConfirm(): Promise<void> {
        if (busy) return;
        setError(null);
        if (signerNumber === null) {
            setError("Select the person who signed this category.");
            return;
        }
        if (differs && reason.trim() === "") {
            setError("A different person signed, so please add a short explanation of why.");
            return;
        }
        const strokes = padRef.current?.exportStrokes() ?? [];
        if (strokes.length === 0) {
            setError("Draw the signature in the pad before saving.");
            return;
        }
        setBusy(true);
        try {
            await onConfirm({
                signatureStrokes: serializeInk({ pages: [{ page: 1, strokes }] }),
                signedByUserId: signerNumber,
                substitutionReason: reason.trim() === "" ? null : reason.trim(),
                remarks: remarks.trim() === "" ? null : remarks.trim(),
            });
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save the signature. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Collect signature</DialogTitle>
                    <DialogDescription>{item.label_snapshot}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="clearance-sign-by">Who signed this category</Label>
                        <SignerCombobox
                            id="clearance-sign-by"
                            candidates={candidates}
                            value={signerId}
                            onValueChange={setSignerId}
                            disabled={busy}
                            placeholder={
                                candidates.length > 0
                                    ? `Search ${candidates.length} signers…`
                                    : "Select the person who signed…"
                            }
                        />
                        {item.expected_signer_user_id !== null && (
                            <p className="text-xs text-muted-foreground">
                                Chosen signer: {expectedName ?? "Loading name…"}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="clearance-substitution-reason">
                            Explanation {differs ? "(required)" : "(only if someone else signed)"}
                        </Label>
                        <Textarea
                            id="clearance-substitution-reason"
                            placeholder="For example: the chosen signer was on leave, so the assistant manager signed instead."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            disabled={busy}
                            rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                            Fill this in when the person who signed is not the chosen signer.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="clearance-remarks">Note (optional)</Label>
                        <Textarea
                            id="clearance-remarks"
                            placeholder="Anything HR should know about this category."
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            disabled={busy}
                            rows={2}
                        />
                    </div>
                    <div className="space-y-2">
                        <SignaturePad
                            ref={padRef}
                            onStrokesChange={(strokes) => setHasInk(strokes.length > 0)}
                        />
                        {hasInk && (
                            <p className="text-xs text-muted-foreground">
                                Signature captured. Saving records it permanently for this category.
                            </p>
                        )}
                    </div>
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" aria-hidden="true" />
                            <AlertTitle>Could not save the signature.</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button disabled={busy} onClick={() => void handleConfirm()}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                        {busy ? "Saving…" : "Save signature"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
