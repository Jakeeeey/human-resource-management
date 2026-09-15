"use client";

import { useState } from "react";

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

import { useTrainingTemplatesCatalog } from "../hooks/useTrainingTemplatesCatalog";
import type { TrainingTemplateRow } from "../types/training-templates.schema";
import { MultiCombobox, type MultiComboboxOption } from "./MultiCombobox";

// TemplateFormDialog.tsx — create/edit dialog for one training template.
// `code` is immutable after create, so it renders read-only in edit mode. The
// department picker is the multi-select combobox: ZERO picks means GLOBAL (the
// template applies to every department) — never a sentinel chip, which would be
// persisted to the junction as a fake department. `is_active` is toggled from
// the template table, never here.

export interface TrainingTemplateFormValues {
  code: string;
  title: string;
  description: string;
  /** Empty = GLOBAL. */
  departmentIds: number[];
}

interface TemplateFormDialogProps {
  open: boolean;
  saving: boolean;
  /** null = create mode; a row = edit mode. */
  row: TrainingTemplateRow | null;
  onClose: () => void;
  onSave: (values: TrainingTemplateFormValues) => void;
}

function TemplateForm({
  row,
  saving,
  onClose,
  onSave,
}: Omit<TemplateFormDialogProps, "open">) {
  const { departments } = useTrainingTemplatesCatalog();
  const isEdit = row !== null;
  const [code, setCode] = useState(row?.code ?? "");
  const [title, setTitle] = useState(row?.title ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [departmentValues, setDepartmentValues] = useState<string[]>(
    (row?.department_ids ?? []).map(String)
  );
  const [error, setError] = useState<string | null>(null);

  const departmentOptions: MultiComboboxOption[] = departments.rows.map(
    (department) => ({
      value: String(department.department_id),
      label: department.department_name,
    })
  );

  const handleSave = () => {
    if (code.trim() === "") {
      setError("Code is required");
      return;
    }
    if (title.trim() === "") {
      setError("Title is required");
      return;
    }
    onSave({
      code: code.trim(),
      title: title.trim(),
      description: description.trim(),
      departmentIds: departmentValues.map(Number),
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Edit training template" : "New training template"}
        </DialogTitle>
        <DialogDescription>
            {isEdit
            ? "Update this template. Active is toggled directly in the table."
            : "Add a training template. Choose the departments that need it, or leave it blank to apply to all departments."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="training-template-code">
            Code
            <span className="text-destructive" aria-hidden="true">
              {" *"}
            </span>
          </Label>
          <Input
            id="training-template-code"
            value={code}
            disabled={saving}
            readOnly={isEdit}
            placeholder="e.g. onsite_safety"
            aria-required
            className="read-only:bg-muted/40 read-only:text-muted-foreground"
            onChange={(event) => {
              setCode(event.target.value);
              setError(null);
            }}
          />
          <p className="text-xs text-muted-foreground">
            {isEdit
              ? "Immutable after create."
              : "Required. Permanent — used as the template code."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="training-template-title">
            Title
            <span className="text-destructive" aria-hidden="true">
              {" *"}
            </span>
          </Label>
          <Input
            id="training-template-title"
            value={title}
            disabled={saving}
            placeholder="e.g. On-site safety training"
            aria-required
            onChange={(event) => {
              setTitle(event.target.value);
              setError(null);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="training-template-description">Description</Label>
          <Input
            id="training-template-description"
            value={description}
            disabled={saving}
            placeholder="Optional summary"
            onChange={(event) => setDescription(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">Optional.</p>
        </div>

        <div className="space-y-2">
          <Label>Departments</Label>
          <MultiCombobox
            options={departmentOptions}
            values={departmentValues}
            onValuesChange={setDepartmentValues}
            placeholder="All Departments"
            ariaLabel="Departments"
            searchPlaceholder="Search departments…"
            emptyMessage="No departments found."
            disabled={saving}
          />
          <p className="text-xs text-muted-foreground">
            Leave Selection Empty for All Departments
          </p>
        </div>

        {error !== null && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Renders the training-template create/edit dialog.
 * @param props Open/saving state, the row being edited, and the save handler.
 * @returns The dialog; its form remounts per open so state seeds from props.
 */
export function TemplateFormDialog({
  open,
  saving,
  row,
  onClose,
  onSave,
}: TemplateFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto rounded-2xl sm:max-w-[560px]">
        {open && (
          <TemplateForm
            key={`${row?.id ?? "new"}:${(row?.department_ids ?? []).join(",")}`}
            row={row}
            saving={saving}
            onClose={onClose}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
