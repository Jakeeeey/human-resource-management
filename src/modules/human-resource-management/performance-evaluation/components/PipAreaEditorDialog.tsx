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
import { Switch } from "@/components/ui/switch";
import type { PipCriterion } from "../types/performance-evaluation.schema";

export interface PipAreaFormValues {
  area_name: string;
  is_active: boolean;
}

interface PipAreaEditorDialogProps {
  open: boolean;
  area: PipCriterion | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: PipAreaFormValues) => void;
}

function PipAreaForm({
  area,
  saving,
  error,
  onClose,
  onSave,
}: Omit<PipAreaEditorDialogProps, "open">) {
  const [name, setName] = useState(area?.area_name ?? "");
  const [isActive, setIsActive] = useState(area?.is_active ?? true);
  const [formError, setFormError] = useState<string | null>(null);

  const missingRequired = name.trim() === "";

  const handleSave = () => {
    if (name.trim() === "") {
      setFormError("Area name is required.");
      return;
    }
    onSave({ area_name: name.trim(), is_active: isActive });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{area ? "Edit PIP area" : "Add PIP area"}</DialogTitle>
        <DialogDescription>
          {area
            ? "Update this area in the shared PIP library."
            : "Add a new area to the shared PIP library."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pip-area-name">
            Area name <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Input
            id="pip-area-name"
            value={name}
            disabled={saving}
            maxLength={150}
            placeholder="e.g. Attendance"
            onChange={(event) => {
              setName(event.target.value);
              setFormError(null);
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch id="pip-area-active" checked={isActive} disabled={saving} onCheckedChange={setIsActive} />
          <Label htmlFor="pip-area-active">Active</Label>
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || missingRequired}
          className="w-full sm:w-auto"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function PipAreaEditorDialog({
  open,
  area,
  saving,
  error,
  onClose,
  onSave,
}: PipAreaEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto rounded-2xl sm:max-w-[480px]">
        {open && (
          <PipAreaForm
            key={area ? `edit-${area.id}` : "create"}
            area={area}
            saving={saving}
            error={error}
            onClose={onClose}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
