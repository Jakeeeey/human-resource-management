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
import { Loader2 } from "lucide-react";
import { EmployeePicker, ResignationPicker } from "./QuitClaimPickers";
import {
    createQuitClaim,
    findRequestIdForResignation,
    quitClaimErrorMessage,
    type EmployeeOption,
    type QuitClaimDetail,
    type ResignationOption,
} from "../providers/quitClaimClient";

interface QuitClaimCreateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (detail: QuitClaimDetail) => void;
}

export function QuitClaimCreateDialog({ open, onOpenChange, onCreated }: QuitClaimCreateDialogProps): JSX.Element {
    const [employee, setEmployee] = useState<EmployeeOption | null>(null);
    const [resignation, setResignation] = useState<ResignationOption | null>(null);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function handleEmployeeChange(next: EmployeeOption | null): void {
        setEmployee(next);
        if (next === null || (resignation !== null && resignation.user_id !== next.user_id)) {
            setResignation(null);
        }
    }

    async function handleCreate(): Promise<void> {
        if (employee === null || creating) {
            return;
        }
        setCreating(true);
        setError(null);
        try {
            let requestId: number | null = null;
            if (resignation !== null) {
                requestId = await findRequestIdForResignation(resignation.id);
            }
            const detail = await createQuitClaim({
                user_id: employee.user_id,
                resignation_id: resignation?.id ?? null,
                request_id: requestId,
            });
            setEmployee(null);
            setResignation(null);
            onCreated(detail);
        } catch (createError) {
            setError(quitClaimErrorMessage(createError, "Failed to create the quit claim."));
        } finally {
            setCreating(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-2xl"
                onFocusOutside={(event) => event.preventDefault()}
            >
                <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
                    <DialogTitle className="text-base">New quit claim</DialogTitle>
                    <DialogDescription>
                        Pick an employee and, optionally, a resignation. Identity fields and the
                        routing table are prefilled from that choice.
                    </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    <EmployeePicker value={employee} onValueChange={handleEmployeeChange} disabled={creating} />
                    <ResignationPicker
                        userId={employee?.user_id ?? null}
                        value={resignation}
                        onValueChange={setResignation}
                        disabled={creating}
                    />
                </div>
                <DialogFooter className="shrink-0 flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end">
                    <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={creating}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        disabled={employee === null || creating}
                        onClick={() => void handleCreate()}
                    >
                        {creating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {creating ? "Creating…" : "Create quit claim"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
