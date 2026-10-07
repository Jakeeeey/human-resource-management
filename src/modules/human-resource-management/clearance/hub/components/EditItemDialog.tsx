"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CLEARANCE_SIGNER_TYPES, CLEARANCE_SIGNER_TYPE_LABELS, type ClearanceSignerType } from "../types";
import { useClearanceHubContext } from "../providers/ClearanceHubProvider";
import type { ClearanceHubItem } from "../hooks/useClearanceHub";

interface EditItemDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => Promise<void>;
    item: ClearanceHubItem | null;
}

export function EditItemDialog({ isOpen, onClose, onSaved, item }: EditItemDialogProps) {
    const { updateItem } = useClearanceHubContext();
    const [label, setLabel] = useState("");
    const [signerType, setSignerType] = useState<ClearanceSignerType>("pool");
    const [departmentId, setDepartmentId] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && item) {
            setLabel(item.label_snapshot);
            setSignerType(item.signer_type_snapshot);
            setDepartmentId(item.department_id_snapshot === null ? "" : String(item.department_id_snapshot));
            setFormError(null);
            setIsSaving(false);
        }
    }, [isOpen, item]);

    const handleSave = async () => {
        if (!item) return;
        const trimmedLabel = label.trim();
        if (trimmedLabel === "") {
            setFormError("Category label is required");
            return;
        }
        let parsedDepartment: number | null | undefined;
        if (signerType === "named_department") {
            if (departmentId.trim() === "") {
                setFormError("A department is required for a named department signer");
                return;
            }
            const parsed = Number(departmentId.trim());
            if (!Number.isInteger(parsed) || parsed <= 0) {
                setFormError("Department must be a positive number");
                return;
            }
            parsedDepartment = parsed;
        } else if (departmentId.trim() === "") {
            parsedDepartment = null;
        } else {
            const parsed = Number(departmentId.trim());
            if (!Number.isInteger(parsed) || parsed <= 0) {
                setFormError("Department must be a positive number");
                return;
            }
            parsedDepartment = parsed;
        }
        const input: { label?: string; signer_type?: ClearanceSignerType; department_id?: number | null } = {};
        if (trimmedLabel !== item.label_snapshot) input.label = trimmedLabel;
        if (signerType !== item.signer_type_snapshot) input.signer_type = signerType;
        if (parsedDepartment !== item.department_id_snapshot) input.department_id = parsedDepartment;
        if (Object.keys(input).length === 0) {
            setFormError("No changes to save");
            return;
        }
        setIsSaving(true);
        setFormError(null);
        try {
            await updateItem(item.id, input);
            toast.success("Clearance item updated");
            await onSaved();
            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to update clearance item";
            setFormError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="sm:max-w-125 data-[state=closed]:duration-100 data-[state=open]:duration-150">
                <DialogHeader>
                    <DialogTitle>Edit Category</DialogTitle>
                    <DialogDescription>
                        Only the label, signer type, and department of this copy can be edited
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="clearance-item-label">Category label</Label>
                        <Input
                            id="clearance-item-label"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            disabled={isSaving}
                            maxLength={255}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label>Signer type</Label>
                        <Select
                            value={signerType}
                            onValueChange={(value) => setSignerType(value as ClearanceSignerType)}
                            disabled={isSaving}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CLEARANCE_SIGNER_TYPES.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {CLEARANCE_SIGNER_TYPE_LABELS[type]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {item?.signer_type_snapshot === "pool" && item?.status !== "signed" && (
                        <p className="text-xs text-muted-foreground">
                            Pool members are changed with Replace Pool on the clearance detail.
                        </p>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="clearance-item-department">
                            Department {signerType === "named_department" ? "" : "(optional)"}
                        </Label>
                        <Input
                            id="clearance-item-department"
                            value={departmentId}
                            onChange={(e) => setDepartmentId(e.target.value)}
                            disabled={isSaving}
                            inputMode="numeric"
                            placeholder={item?.department_name_snapshot ?? "None"}
                        />
                        {item?.department_name_snapshot && (
                            <p className="text-xs text-muted-foreground">
                                Current: {item.department_name_snapshot}
                            </p>
                        )}
                    </div>

                    {formError && (
                        <Alert variant="destructive">
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
