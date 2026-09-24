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
import { Textarea } from "@/components/ui/textarea";
import type { EvaluationCriterion } from "../types/performance-evaluation.schema";

export interface KpiCriterionFormValues {
  kpi_category: string;
  kpi_description: string;
  target: string | null;
  measurement_method: string | null;
  weight_percentage: number;
  is_active: boolean;
}

interface KpiCriteriaEditorDialogProps {
  open: boolean;
  criterion: EvaluationCriterion | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: KpiCriterionFormValues) => void;
}

function KpiCriterionForm({
  criterion,
  saving,
  error,
  onClose,
  onSave,
}: Omit<KpiCriteriaEditorDialogProps, "open">) {
  const [category, setCategory] = useState(criterion?.kpi_category ?? "");
  const [description, setDescription] = useState(criterion?.kpi_description ?? "");
  const [target, setTarget] = useState(criterion?.target ?? "");
  const [measurementMethod, setMeasurementMethod] = useState(criterion?.measurement_method ?? "");
  const [weight, setWeight] = useState(criterion ? String(criterion.weight_percentage) : "");
  const [isActive, setIsActive] = useState(criterion?.is_active ?? true);
  const [formError, setFormError] = useState<string | null>(null);

  const parsedWeight = Number(weight);
  const weightValid = weight.trim() !== "" && Number.isFinite(parsedWeight) && parsedWeight >= 0 && parsedWeight <= 100;
  const missingRequired = category.trim() === "" || description.trim() === "";

  const handleSave = () => {
    if (category.trim() === "") {
      setFormError("KPI category is required.");
      return;
    }
    if (description.trim() === "") {
      setFormError("Description is required.");
      return;
    }
    if (!weightValid) {
      setFormError("Weight must be a number between 0 and 100.");
      return;
    }
    onSave({
      kpi_category: category.trim(),
      kpi_description: description.trim(),
      target: target.trim() === "" ? null : target.trim(),
      measurement_method: measurementMethod.trim() === "" ? null : measurementMethod.trim(),
      weight_percentage: parsedWeight,
      is_active: isActive,
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{criterion ? "Edit KPI criterion" : "Add KPI criterion"}</DialogTitle>
        <DialogDescription>
          {criterion
            ? "Update this criterion in your department's KPI library."
            : "Add a new criterion to your department's KPI library."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="kpi-category">
            KPI category <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Input
            id="kpi-category"
            value={category}
            disabled={saving}
            maxLength={150}
            placeholder="e.g. Quality of Work"
            onChange={(event) => {
              setCategory(event.target.value);
              setFormError(null);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="kpi-description">
            Description <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Textarea
            id="kpi-description"
            value={description}
            disabled={saving}
            maxLength={2000}
            placeholder="What this criterion measures"
            onChange={(event) => {
              setDescription(event.target.value);
              setFormError(null);
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="kpi-target">Target</Label>
            <Input
              id="kpi-target"
              value={target}
              disabled={saving}
              maxLength={255}
              placeholder="e.g. 95% on-time"
              onChange={(event) => setTarget(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kpi-method">Measurement method</Label>
            <Input
              id="kpi-method"
              value={measurementMethod}
              disabled={saving}
              maxLength={255}
              placeholder="e.g. Supervisor review"
              onChange={(event) => setMeasurementMethod(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="kpi-weight">
            Weight % <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Input
            id="kpi-weight"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.01"
            value={weight}
            disabled={saving}
            placeholder="e.g. 25"
            onChange={(event) => {
              setWeight(event.target.value);
              setFormError(null);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Active criteria must total 100% before evaluations can be created.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="kpi-active" checked={isActive} disabled={saving} onCheckedChange={setIsActive} />
          <Label htmlFor="kpi-active">Active</Label>
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
          disabled={saving || missingRequired || !weightValid}
          className="w-full sm:w-auto"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function KpiCriteriaEditorDialog({
  open,
  criterion,
  saving,
  error,
  onClose,
  onSave,
}: KpiCriteriaEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto rounded-2xl sm:max-w-[560px]">
        {open && (
          <KpiCriterionForm
            key={criterion ? `edit-${criterion.id}` : "create"}
            criterion={criterion}
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
