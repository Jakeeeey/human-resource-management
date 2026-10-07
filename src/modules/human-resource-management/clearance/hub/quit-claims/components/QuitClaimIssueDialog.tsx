"use client";

import { useState } from "react";
import type { JSX } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Loader2 } from "lucide-react";
import { QuitClaimCompanySelect } from "./QuitClaimCompanySelect";
import {
    isAlreadyIssuedError,
    issueQuitClaim,
    quitClaimErrorMessage,
    type ClearanceQuitclaim,
    type IssueQuitClaimResult,
} from "../providers/quitClaimClient";
import type { CompanyOption } from "../../utils/company";

interface QuitClaimIssueDialogProps {
    quitclaim: ClearanceQuitclaim | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onIssued: (result: IssueQuitClaimResult) => void;
}

export function QuitClaimIssueDialog({ quitclaim, open, onOpenChange, onIssued }: QuitClaimIssueDialogProps): JSX.Element {
    const [company, setCompany] = useState<CompanyOption | null>(null);
    const [issuing, setIssuing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleIssue(): Promise<void> {
        if (quitclaim === null || company === null || issuing) {
            return;
        }
        setIssuing(true);
        setError(null);
        try {
            const result = await issueQuitClaim(quitclaim.id, company.company_code);
            onIssued(result);
            onOpenChange(false);
        } catch (issueError) {
            if (isAlreadyIssuedError(issueError)) {
                setError("This quit claim is already issued. Issued documents are frozen and cannot be issued again.");
            } else {
                setError(quitClaimErrorMessage(issueError, "Failed to issue the quit claim."));
            }
        } finally {
            setIssuing(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-lg"
                onFocusOutside={(event) => event.preventDefault()}
            >
                <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
                    <DialogTitle className="text-base">Issue quit claim</DialogTitle>
                    <DialogDescription>
                        Issuing allocates the reference number and freezes the document. This cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    <div className="space-y-1">
                        <Label htmlFor="quitclaim-issue-company">Company</Label>
                        <QuitClaimCompanySelect
                            id="quitclaim-issue-company"
                            value={company}
                            onValueChange={setCompany}
                            preferredCompanyCode={quitclaim?.company_code ?? undefined}
                            disabled={issuing}
                        />
                        <p className="text-xs text-muted-foreground">
                            The reference number is allocated per company and year.
                        </p>
                    </div>
                </div>
                <DialogFooter className="shrink-0 flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end">
                    <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={issuing}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        disabled={company === null || issuing}
                        onClick={() => void handleIssue()}
                    >
                        {issuing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {issuing ? "Issuing…" : "Issue quit claim"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
