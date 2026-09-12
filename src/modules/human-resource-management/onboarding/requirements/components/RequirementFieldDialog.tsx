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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// RequirementFieldDialog.tsx — config-driven create/edit dialog shared by the
// four requirements sections. A field list describes the inputs; the dialog
// owns form state and the required-field check, and hands the raw string values
// back so each section can map them to its own typed create/update body.
//
// Immutable fields (natural keys: `doc_key`, `item_key`, `code`, and the
// orientation `track` the update contract refuses) render read-only in edit
// mode — the keys are referenced by file markers / issue doc_refs / derived
// templates and must never change after create.

export interface RequirementDialogField {
  name: string;
  label: string;
  kind: "text" | "select";
  placeholder?: string;
  hint?: string;
  required?: boolean;
  /** Rendered disabled when editing (create still accepts the value). */
  immutable?: boolean;
  options?: readonly { value: string; label: string }[];
}

interface RequirementFieldDialogProps {
  open: boolean;
  heading: string;
  description?: string;
  isEdit: boolean;
  saving: boolean;
  fields: readonly RequirementDialogField[];
  initial: Record<string, string>;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

function RequirementForm({
  heading,
  description,
  isEdit,
  saving,
  fields,
  initial,
  onClose,
  onSave,
}: Omit<RequirementFieldDialogProps, "open">) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [error, setError] = useState<string | null>(null);

  const setValue = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSave = () => {
    for (const field of fields) {
      if (field.required && (values[field.name] ?? "").trim() === "") {
        setError(`${field.label} is required`);
        return;
      }
    }
    onSave(values);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{heading}</DialogTitle>
        {description !== undefined && (
          <DialogDescription>{description}</DialogDescription>
        )}
      </DialogHeader>

      <div className="space-y-4">
        {fields.map((field) => {
          const value = values[field.name] ?? "";
          const locked = saving || (isEdit && field.immutable === true);
          return (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={`req-${field.name}`}>{field.label}</Label>
              {field.kind === "select" ? (
                <Select
                  value={value}
                  disabled={locked}
                  onValueChange={(next) => setValue(field.name, next)}
                >
                  <SelectTrigger
                    id={`req-${field.name}`}
                    className="w-full"
                    disabled={locked}
                  >
                    <SelectValue placeholder={field.placeholder ?? "Select…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options ?? []).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={`req-${field.name}`}
                  value={value}
                  disabled={locked}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    setValue(field.name, event.target.value)
                  }
                />
              )}
              {field.hint !== undefined && (
                <p className="text-xs text-muted-foreground">{field.hint}</p>
              )}
            </div>
          );
        })}
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
 * Create/edit dialog driven by a field config.
 * @param props Dialog state, field list, initial values, save handler.
 * @returns The dialog; its form remounts per open so state seeds from props.
 */
export function RequirementFieldDialog({
  open,
  heading,
  description,
  isEdit,
  saving,
  fields,
  initial,
  onClose,
  onSave,
}: RequirementFieldDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto rounded-2xl sm:max-w-[560px]">
        {open && (
          <RequirementForm
            key={`${heading}:${isEdit ? "edit" : "create"}`}
            heading={heading}
            description={description}
            isEdit={isEdit}
            saving={saving}
            fields={fields}
            initial={initial}
            onClose={onClose}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
