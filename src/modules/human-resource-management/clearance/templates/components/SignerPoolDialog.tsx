"use client";

import { useState } from "react";
import type { JSX } from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

import type { DirectoryEmployee } from "../providers/clearanceDirectoryClient";
import type { ClearanceCategory } from "../types";
import { EmployeeSelect } from "./DirectorySelects";

export interface SignerPoolDialogProps {
    open: boolean;
    category: ClearanceCategory | null;
    employees: readonly DirectoryEmployee[];
    initialUserIds: readonly number[];
    loadingPool: boolean;
    directoryIsError?: boolean;
    directoryError?: string | null;
    onRetryDirectory?: () => void;
    saving: boolean;
    employeeName: (id: number) => string;
    onClose: () => void;
    onSave: (userIds: number[]) => void;
}

function SignerPoolForm(
    props: Omit<SignerPoolDialogProps, "open" | "category" | "loadingPool">
): JSX.Element {
    const { employees, initialUserIds, saving, onClose, onSave, employeeName, directoryIsError = false, directoryError = null, onRetryDirectory } = props;

    const [selected, setSelected] = useState<number[]>([...initialUserIds]);
    const [pickerValue, setPickerValue] = useState("");

    const available = employees.filter((employee) => !selected.includes(employee.id));

    const addMember = (value: string) => {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed <= 0 || selected.includes(parsed)) {
            return;
        }
        setSelected((prev) => [...prev, parsed]);
        setPickerValue("");
    };

    const removeMember = (id: number) => {
        setSelected((prev) => prev.filter((member) => member !== id));
    };

    return (
        <>
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Add signers</Label>
                    {directoryIsError && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Could not load employees</AlertTitle>
                            <AlertDescription className="space-y-2">
                                <p>{directoryError ?? "The employee directory is unavailable."}</p>
                                {onRetryDirectory && (
                                    <Button variant="outline" size="sm" onClick={onRetryDirectory}>
                                        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                                        Retry
                                    </Button>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}
                    <EmployeeSelect
                        employees={available}
                        value={pickerValue}
                        onValueChange={addMember}
                        placeholder="Search employees to add…"
                        searchPlaceholder="Search employees…"
                        disabled={saving}
                        emptyMessage={
                            directoryIsError
                                ? "Could not load employees. Retry, then search again."
                                : undefined
                        }
                    />
                </div>

                {selected.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No signers yet. At least one signer is required — add one above.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {selected.map((id) => (
                            <li
                                key={id}
                                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                            >
                                <span className="min-w-0 flex-1 truncate text-sm" title={employeeName(id)}>
                                    {employeeName(id)}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Remove ${employeeName(id)}`}
                                    disabled={saving || selected.length <= 1}
                                    onClick={() => removeMember(id)}
                                    className="focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                        {selected.length} {selected.length === 1 ? "signer" : "signers"}
                    </Badge>
                </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
                    Cancel
                </Button>
                <Button
                    onClick={() => onSave(selected)}
                    disabled={saving || selected.length === 0}
                    className="w-full sm:w-auto"
                >
                    {saving ? "Saving…" : "Save pool"}
                </Button>
            </DialogFooter>
        </>
    );
}

export function SignerPoolDialog(props: SignerPoolDialogProps): JSX.Element {
    const { open, category, onClose, loadingPool } = props;
    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto rounded-2xl data-[state=closed]:duration-100 data-[state=open]:duration-150 sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Signer pool</DialogTitle>
                    {category !== null && !loadingPool && (
                        <DialogDescription>
                            Who may sign {category.label}. Replacing the pool never submits an empty list.
                        </DialogDescription>
                    )}
                </DialogHeader>
                {open &&
                    (category === null || loadingPool ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">Loading signer pool…</p>
                    ) : (
                        <SignerPoolForm
                            key={`pool-${category.id}-${props.initialUserIds.join(",")}`}
                            employees={props.employees}
                            initialUserIds={props.initialUserIds}
                            saving={props.saving}
                            onClose={props.onClose}
                            onSave={props.onSave}
                            employeeName={props.employeeName}
                            directoryIsError={props.directoryIsError}
                            directoryError={props.directoryError}
                            onRetryDirectory={props.onRetryDirectory}
                        />
                    ))}
            </DialogContent>
        </Dialog>
    );
}
