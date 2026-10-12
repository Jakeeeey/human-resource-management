"use client";

import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import type { DirectoryDepartment, DirectoryEmployee } from "../providers/clearanceDirectoryClient";
import type { CategoryCreateInput, CategoryUpdateInput } from "../providers/clearanceTemplatesClient";
import {
    CLEARANCE_SIGNER_TYPE_LABELS,
    CLEARANCE_SIGNER_TYPES,
    type ClearanceCategory,
    type ClearanceSignerType,
} from "../types";
import { DepartmentSelect, EmployeeSelect } from "./DirectorySelects";

export interface CategoryDialogProps {
    open: boolean;
    category: ClearanceCategory | null;
    departments: readonly DirectoryDepartment[];
    employees: readonly DirectoryEmployee[];
    employeeName: (id: number) => string;
    directoryIsError?: boolean;
    directoryError?: string | null;
    onRetryDirectory?: () => void;
    saving: boolean;
    onClose: () => void;
    onCreate: (input: CategoryCreateInput, poolUserIds: number[]) => void;
    onUpdate: (input: CategoryUpdateInput) => void;
}

function isSignerType(value: string): value is ClearanceSignerType {
    return (CLEARANCE_SIGNER_TYPES as readonly string[]).includes(value);
}

function CategoryForm(
    props: Omit<CategoryDialogProps, "open" | "category"> & { category: ClearanceCategory | null }
): JSX.Element {
    const { category, departments, employees, employeeName, directoryIsError = false, directoryError = null, onRetryDirectory, saving, onClose, onCreate, onUpdate } = props;
    const isEdit = category !== null;

    const [label, setLabel] = useState(category?.label ?? "");
    const [instructions, setInstructions] = useState(category?.instructions ?? "");
    const [signerType, setSignerType] = useState<ClearanceSignerType>(category?.signer_type ?? "pool");
    const [departmentId, setDepartmentId] = useState<number | null>(category?.department_id ?? null);
    const [isActive, setIsActive] = useState(category?.is_active ?? true);
    const [poolIds, setPoolIds] = useState<number[]>([]);
    const [pickerValue, setPickerValue] = useState("");
    const [error, setError] = useState<string | null>(null);

    const availableEmployees = useMemo(
        () => employees.filter((employee) => !poolIds.includes(employee.id)),
        [employees, poolIds]
    );

    const needsDepartment = signerType === "named_department";
    const needsPool = !isEdit && signerType === "pool";
    const missingRequired =
        label.trim() === "" || (needsDepartment && departmentId === null) || (needsPool && poolIds.length === 0);

    const addPoolMember = (value: string) => {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed <= 0 || poolIds.includes(parsed)) {
            return;
        }
        setPoolIds((prev) => [...prev, parsed]);
        setPickerValue("");
        setError(null);
    };

    const removePoolMember = (id: number) => {
        setPoolIds((prev) => prev.filter((member) => member !== id));
    };

    const handleSave = () => {
        if (label.trim() === "") {
            setError("Label is required");
            return;
        }
        if (needsDepartment && departmentId === null) {
            setError("A department is required for a named-department signer");
            return;
        }
        if (needsPool && poolIds.length === 0) {
            setError("At least one signer is required for a signer pool");
            return;
        }
        const normalizedInstructions = instructions.trim() === "" ? null : instructions.trim();
        if (isEdit) {
            onUpdate({
                label: label.trim(),
                instructions: normalizedInstructions,
                signer_type: signerType,
                department_id: signerType === "named_department" ? departmentId : null,
                is_active: isActive,
            });
            return;
        }
        onCreate(
            {
                label: label.trim(),
                instructions: normalizedInstructions,
                signer_type: signerType,
                department_id: signerType === "named_department" ? departmentId : null,
            },
            signerType === "pool" ? poolIds : []
        );
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle>{isEdit ? "Edit category" : "New category"}</DialogTitle>
                <DialogDescription>
                    {isEdit
                        ? "Update this clearance category."
                        : "Add a new clearance category. One signature satisfies each category."}
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="clearance-category-label">
                        Label<span className="text-destructive" aria-hidden="true">{" *"}</span>
                    </Label>
                    <Input
                        id="clearance-category-label"
                        value={label}
                        disabled={saving}
                        maxLength={255}
                        placeholder="e.g. IT assets"
                        aria-required="true"
                        onChange={(event) => {
                            setLabel(event.target.value);
                            setError(null);
                        }}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="clearance-category-instructions">Instructions</Label>
                    <Textarea
                        id="clearance-category-instructions"
                        value={instructions}
                        disabled={saving}
                        placeholder="What the employee must settle for this category"
                        onChange={(event) => setInstructions(event.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="clearance-category-signer">Signer</Label>
                    <Select
                        value={signerType}
                        disabled={saving}
                        onValueChange={(next) => {
                            if (isSignerType(next)) {
                                setSignerType(next);
                                setError(null);
                            }
                        }}
                    >
                        <SelectTrigger id="clearance-category-signer" className="w-full" aria-describedby="clearance-category-signer-help">
                            <SelectValue placeholder="Select a signer" />
                        </SelectTrigger>
                        <SelectContent>
                            {CLEARANCE_SIGNER_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                    {CLEARANCE_SIGNER_TYPE_LABELS[type]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p id="clearance-category-signer-help" className="text-sm text-muted-foreground">
                        Who may sign. The employee picks one signer from this group.
                    </p>
                    {isEdit && signerType === "pool" && (
                        <p className="text-sm text-muted-foreground">
                            Pool members are managed from the signer pool action on the category row.
                        </p>
                    )}
                </div>

                {needsDepartment && (
                    <div className="space-y-2">
                        <Label>
                            Department<span className="text-destructive" aria-hidden="true">{" *"}</span>
                        </Label>
                        <DepartmentSelect
                            id="clearance-category-department"
                            departments={departments}
                            value={departmentId}
                            onValueChange={(next) => {
                                setDepartmentId(next);
                                setError(null);
                            }}
                            noneLabel="Select a department"
                            placeholder="Select the signing department"
                            searchPlaceholder="Search departments…"
                            disabled={saving}
                        />
                    </div>
                )}

                {needsPool && (
                    <div className="space-y-2">
                        <Label>
                            Signers<span className="text-destructive" aria-hidden="true">{" *"}</span>
                        </Label>
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
                            id="clearance-category-pool"
                            employees={availableEmployees}
                            value={pickerValue}
                            onValueChange={addPoolMember}
                            placeholder="Search employees to add…"
                            searchPlaceholder="Search employees…"
                            disabled={saving}
                            emptyMessage={
                                directoryIsError
                                    ? "Could not load employees. Retry, then search again."
                                    : undefined
                            }
                        />
                        {poolIds.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                At least one signer is required for a signer pool.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-1.5">
                                {poolIds.map((id) => (
                                    <Badge key={id} variant="secondary" className="gap-1 py-1">
                                        <span className="max-w-[180px] truncate" title={employeeName(id)}>
                                            {employeeName(id)}
                                        </span>
                                        <button
                                            type="button"
                                            aria-label={`Remove ${employeeName(id)}`}
                                            disabled={saving}
                                            onClick={() => removePoolMember(id)}
                                            className="rounded-full hover:text-destructive"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                    <div className="space-y-0.5">
                        <Label htmlFor="clearance-category-active">Active</Label>
                        <p className="text-sm text-muted-foreground">
                            Only active categories are copied to new clearances.
                        </p>
                    </div>
                    <Switch
                        id="clearance-category-active"
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

export function CategoryDialog(props: CategoryDialogProps): JSX.Element {
    const { open, category, onClose } = props;
    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto rounded-2xl data-[state=closed]:duration-100 data-[state=open]:duration-150 sm:max-w-[560px]">
                {open && (
                    <CategoryForm
                        key={category === null ? "create" : `edit-${category.id}`}
                        category={category}
                        departments={props.departments}
                        employees={props.employees}
                        employeeName={props.employeeName}
                        directoryIsError={props.directoryIsError}
                        directoryError={props.directoryError}
                        onRetryDirectory={props.onRetryDirectory}
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
