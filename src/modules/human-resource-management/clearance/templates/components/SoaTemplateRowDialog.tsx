"use client";

import { useState } from "react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import type { SoaRowCreateInput, SoaRowUpdateInput } from "../providers/soaTemplatesClient";
import type { SoaTemplateRow } from "../types";

export interface SoaTemplateRowDialogProps {
    open: boolean;
    row: SoaTemplateRow | null;
    saving: boolean;
    onClose: () => void;
    onCreate: (input: SoaRowCreateInput) => void;
    onUpdate: (input: SoaRowUpdateInput) => void;
}

function SoaTemplateRowForm(
    props: Omit<SoaTemplateRowDialogProps, "open" | "row"> & { row: SoaTemplateRow | null }
): JSX.Element {
    const { row, saving, onClose, onCreate, onUpdate } = props;
    const isEdit = row !== null;

    const [label, setLabel] = useState(row?.label ?? "");
    const [isActive, setIsActive] = useState(row?.is_active ?? true);
    const [error, setError] = useState<string | null>(null);

    const missingRequired = label.trim() === "";

    const handleSave = () => {
        if (label.trim() === "") {
            setError("Label is required");
            return;
        }
        if (isEdit) {
            onUpdate({ label: label.trim(), is_active: isActive });
            return;
        }
        onCreate({ label: label.trim() });
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle>{isEdit ? "Edit SOA row" : "New SOA row"}</DialogTitle>
                <DialogDescription>
                    {isEdit
                        ? "Update this SOA department group."
                        : "Add a new department group. Each group becomes a DEPARTMENT cell on the printed SOA."}
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="soa-row-label">
                        Label<span className="text-destructive" aria-hidden="true">{" *"}</span>
                    </Label>
                    <Input
                        id="soa-row-label"
                        value={label}
                        disabled={saving}
                        maxLength={255}
                        placeholder="e.g. IT Department"
                        aria-required="true"
                        onChange={(event) => {
                            setLabel(event.target.value);
                            setError(null);
                        }}
                    />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                    <div className="space-y-0.5">
                        <Label htmlFor="soa-row-active">Active</Label>
                        <p className="text-sm text-muted-foreground">
                            Only active rows are copied to new statements of account.
                        </p>
                    </div>
                    <Switch
                        id="soa-row-active"
                        checked={isActive}
                        disabled={saving}
                        onCheckedChange={setIsActive}
                        className="focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    />
                </div>

                {error !== null && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
                    Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || missingRequired} className="w-full sm:w-auto">
                    {saving ? "Saving…" : "Save"}
                </Button>
            </DialogFooter>
        </>
    );
}

export function SoaTemplateRowDialog(props: SoaTemplateRowDialogProps): JSX.Element {
    const { open, row, onClose } = props;
    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto rounded-2xl data-[state=closed]:duration-100 data-[state=open]:duration-150 sm:max-w-[560px]">
                {open && (
                    <SoaTemplateRowForm
                        key={row === null ? "create" : `edit-${row.id}`}
                        row={row}
                        saving={props.saving}
                        onClose={props.onClose}
                        onCreate={props.onCreate}
                        onUpdate={props.onUpdate}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
