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
import { Textarea } from "@/components/ui/textarea";

import type { DirectoryDepartment } from "../providers/clearanceDirectoryClient";
import type { TemplateCreateInput, TemplateUpdateInput } from "../providers/clearanceTemplatesClient";
import type { ClearanceTemplate } from "../types";
import { DepartmentSelect } from "./DirectorySelects";

export interface TemplateDialogProps {
    open: boolean;
    template: ClearanceTemplate | null;
    departments: readonly DirectoryDepartment[];
    saving: boolean;
    onClose: () => void;
    onCreate: (input: TemplateCreateInput) => void;
    onUpdate: (input: TemplateUpdateInput) => void;
}

function TemplateForm(props: Omit<TemplateDialogProps, "open" | "template"> & { template: ClearanceTemplate | null }): JSX.Element {
    const { template, departments, saving, onClose, onCreate, onUpdate } = props;
    const isEdit = template !== null;

    const [code, setCode] = useState(template?.code ?? "");
    const [title, setTitle] = useState(template?.title ?? "");
    const [description, setDescription] = useState(template?.description ?? "");
    const [departmentId, setDepartmentId] = useState<number | null>(template?.department_id ?? null);
    const [isActive, setIsActive] = useState(template?.is_active ?? true);
    const [error, setError] = useState<string | null>(null);

    const missingRequired = isEdit ? title.trim() === "" : code.trim() === "" || title.trim() === "";

    const handleSave = () => {
        if (!isEdit && code.trim() === "") {
            setError("Code is required");
            return;
        }
        if (title.trim() === "") {
            setError("Title is required");
            return;
        }
        const normalizedDescription = description.trim() === "" ? null : description.trim();
        if (isEdit) {
            onUpdate({
                title: title.trim(),
                description: normalizedDescription,
                department_id: departmentId,
                is_active: isActive,
            });
            return;
        }
        onCreate({
            code: code.trim(),
            title: title.trim(),
            description: normalizedDescription,
            department_id: departmentId,
        });
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle>{isEdit ? "Edit template" : "New template"}</DialogTitle>
                <DialogDescription>
                    {isEdit
                        ? "Update this clearance template. The code cannot be changed after creation."
                        : "Add a new clearance template to this registry."}
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="clearance-template-code">
                        Code<span className="text-destructive" aria-hidden="true">{" *"}</span>
                    </Label>
                    <Input
                        id="clearance-template-code"
                        value={code}
                        disabled={saving}
                        readOnly={isEdit}
                        maxLength={64}
                        placeholder="e.g. standard_exit"
                        aria-required="true"
                        aria-describedby="clearance-template-code-help"
                        className="read-only:bg-muted/40 read-only:text-muted-foreground"
                        onChange={(event) => {
                            setCode(event.target.value);
                            setError(null);
                        }}
                    />
                    <p id="clearance-template-code-help" className="text-sm text-muted-foreground">
                        {isEdit
                            ? "The code cannot be changed after creation."
                            : "Required. Permanent — assignments snapshot this code."}
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="clearance-template-title">
                        Title<span className="text-destructive" aria-hidden="true">{" *"}</span>
                    </Label>
                    <Input
                        id="clearance-template-title"
                        value={title}
                        disabled={saving}
                        maxLength={255}
                        placeholder="e.g. Standard exit clearance"
                        aria-required="true"
                        onChange={(event) => {
                            setTitle(event.target.value);
                            setError(null);
                        }}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="clearance-template-description">Description</Label>
                    <Textarea
                        id="clearance-template-description"
                        value={description}
                        disabled={saving}
                        placeholder="What this template covers"
                        onChange={(event) => setDescription(event.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Auto-suggest department</Label>
                    <DepartmentSelect
                        id="clearance-template-department"
                        departments={departments}
                        value={departmentId}
                        onValueChange={setDepartmentId}
                        noneLabel="No department — global template"
                        placeholder="Optional — suggest for a department"
                        searchPlaceholder="Search departments…"
                        disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                        Only a suggestion hint when assigning. HR always picks the final template.
                    </p>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                    <div className="space-y-0.5">
                        <Label htmlFor="clearance-template-active">Active</Label>
                        <p className="text-sm text-muted-foreground">
                            Inactive templates are hidden from assignment.
                        </p>
                    </div>
                    <Switch
                        id="clearance-template-active"
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

export function TemplateDialog(props: TemplateDialogProps): JSX.Element {
    const { open, template, onClose } = props;
    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto rounded-2xl data-[state=closed]:duration-100 data-[state=open]:duration-150 sm:max-w-[560px]">
                {open && (
                    <TemplateForm
                        key={template === null ? "create" : `edit-${template.id}`}
                        template={template}
                        departments={props.departments}
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
