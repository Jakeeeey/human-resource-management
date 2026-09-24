"use client";

import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";

import {
  EvaluationClientError,
  createPip,
  updatePip,
} from "../providers/evaluationClient";
import type {
  CreatePipInput,
  UpdatePipInput,
} from "../providers/evaluationClient";
import type { WorkspaceBundle } from "../types/performance-evaluation.schema";

type PlanRow = {
  key: string;
  pipAreaId: number | null;
  area: string;
  action: string;
};

function toDateInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function toDisplayDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

function EmployeeField(props: { label: string; value: string }): JSX.Element {
  const { label, value } = props;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export function PipPlanForm(props: {
  scope: "hr" | "head";
  userId: number;
  bundle: WorkspaceBundle;
  onSaved: () => void;
  readOnly?: boolean;
}): JSX.Element {
  const { scope, bundle, onSaved, readOnly = false } = props;

  const currentPip = useMemo(() => {
    if (bundle.pips.length === 0) return null;
    return [...bundle.pips].sort((a, b) => b.id - a.id)[0];
  }, [bundle.pips]);

  const storedPlans = useMemo(() => {
    if (!currentPip) return [];
    return bundle.pipActionPlans
      .filter((plan) => plan.pip_id === currentPip.id)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [bundle.pipActionPlans, currentPip]);

  const failedEvaluation = useMemo(() => {
    const pipEvaluationIds = new Set(bundle.pips.map((pip) => pip.evaluation_id));
    const candidates = bundle.evaluations.filter(
      (entry) =>
        entry.voided_at == null &&
        entry.result === "failed" &&
        !pipEvaluationIds.has(entry.id),
    );
    candidates.sort((a, b) => b.id - a.id);
    return candidates.length > 0 ? candidates[0] : null;
  }, [bundle.pips, bundle.evaluations]);

  const [fieldsSeed, setFieldsSeed] = useState<number | "new" | "">("");
  const [detailedConcerns, setDetailedConcerns] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [superiorId, setSuperiorId] = useState("");
  const [planRows, setPlanRows] = useState<PlanRow[]>([]);
  const [rowCounter, setRowCounter] = useState(0);

  useEffect(() => {
    const seed = currentPip ? currentPip.id : "new";
    if (seed === fieldsSeed) return;
    setFieldsSeed(seed);
    setDetailedConcerns(currentPip?.detailed_concerns ?? "");
    setStartDate(toDateInput(currentPip?.pip_start_date ?? null));
    setEndDate(toDateInput(currentPip?.pip_end_date ?? null));
    setSuperiorId(
      currentPip?.immediate_superior_id != null
        ? `${currentPip.immediate_superior_id}`
        : "",
    );
    if (storedPlans.length > 0) {
      setPlanRows(
        storedPlans.map((plan) => ({
          key: `plan-${plan.id}`,
          pipAreaId: plan.pip_area_id,
          area: plan.area_for_improvement,
          action: plan.action_plan ?? "",
        })),
      );
    } else {
      setPlanRows([{ key: "plan-new-0", pipAreaId: null, area: "", action: "" }]);
      setRowCounter(1);
    }
  }, [currentPip, storedPlans, fieldsSeed]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const viewerLocked = readOnly;
  const isReadOnly = viewerLocked;

  function updateRow(key: string, patch: Partial<PlanRow>): void {
    setPlanRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addRow(): void {
    const key = `new-${rowCounter}`;
    setRowCounter((count) => count + 1);
    setPlanRows((prev) => [
      ...prev,
      { key, pipAreaId: null, area: "", action: "" },
    ]);
  }

  function removeRow(key: string): void {
    setPlanRows((prev) => prev.filter((row) => row.key !== key));
  }

  function validate(): string | null {
    if (!currentPip && !failedEvaluation) {
      return "There is no failed evaluation to attach this PIP to.";
    }
    for (const row of planRows) {
      if (row.area.trim() === "" || row.action.trim() === "") {
        return "Every action-plan row needs an area for improvement and an action plan.";
      }
    }
    if (superiorId.trim() !== "") {
      const parsed = Number(superiorId);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return "Immediate superior ID must be a positive whole number.";
      }
    }
    if (startDate !== "" && endDate !== "" && endDate < startDate) {
      return "The PIP end date cannot be earlier than the start date.";
    }
    return null;
  }

  const validationError = validate();
  const canSave = !saving && !isReadOnly && validationError == null;

  function resolveSaveError(err: unknown): string {
    if (err instanceof EvaluationClientError) {
      if (err.status === 409) {
        return "A PIP already exists for this evaluation. Reload the workspace to edit it instead.";
      }
      if (err.status === 400) {
        return `The server rejected the PIP: ${err.message}`;
      }
      return err.message;
    }
    if (err instanceof Error) return err.message;
    return "Saving failed. Please try again.";
  }

  async function handleSave(): Promise<void> {
    const problem = validate();
    if (problem) {
      setSaveError(problem);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const trimmedConcerns = detailedConcerns.trim();
      const trimmedSuperior = superiorId.trim();
      const actionPlan = planRows.map((row) => ({
        pip_area_id: row.pipAreaId,
        area: row.area.trim(),
        action: row.action.trim(),
      }));
      if (currentPip) {
        const input: UpdatePipInput = {
          pip_start_date: startDate === "" ? null : startDate,
          pip_end_date: endDate === "" ? null : endDate,
          immediate_superior_id:
            trimmedSuperior === "" ? null : Number(trimmedSuperior),
          detailed_concerns: trimmedConcerns === "" ? null : trimmedConcerns,
          action_plan: actionPlan,
        };
        await updatePip(currentPip.id, input);
      } else {
        if (!failedEvaluation) {
          setSaveError("There is no failed evaluation to attach this PIP to.");
          return;
        }
        const input: CreatePipInput = {
          evaluation_id: failedEvaluation.id,
          pip_start_date: startDate === "" ? null : startDate,
          pip_end_date: endDate === "" ? null : endDate,
          immediate_superior_id:
            trimmedSuperior === "" ? null : Number(trimmedSuperior),
          detailed_concerns: trimmedConcerns === "" ? null : trimmedConcerns,
          action_plan: actionPlan,
        };
        await createPip(input);
      }
      onSaved();
    } catch (err: unknown) {
      setSaveError(resolveSaveError(err));
    } finally {
      setSaving(false);
    }
  }

  if (!currentPip && !failedEvaluation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Performance Improvement Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm font-semibold">No failed evaluation</p>
            <p className="text-sm text-muted-foreground">
              A PIP can only be opened from a failed evaluation. There is no
              failed evaluation without a PIP for this employee yet, so there
              is nothing to file.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base font-semibold">
            Performance Improvement Plan
          </CardTitle>
          <StatusBadge tone="neutral">
            {currentPip ? "Edit" : "Draft"}
          </StatusBadge>
          <StatusBadge tone="warning">PIP in progress</StatusBadge>
        </div>
        <p className="text-xs text-muted-foreground">
          {bundle.employee.full_name}
          {bundle.employee.department_name
            ? ` · ${bundle.employee.department_name}`
            : null}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {viewerLocked ? (
          <Alert>
            <AlertTitle>
              {scope === "hr" ? "Awaiting the department head" : "Awaiting HR"}
            </AlertTitle>
            <AlertDescription>
              The department head owns this PIP step. You can review the plan
              and timeline below, but only the department head can submit them.
            </AlertDescription>
          </Alert>
        ) : null}

        <section aria-label="Employee information" className="space-y-3">
          <h3 className="text-sm font-semibold">Employee Information</h3>
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
            <EmployeeField label="Name" value={bundle.employee.full_name} />
            <EmployeeField
              label="Department"
              value={bundle.employee.department_name ?? "—"}
            />
            <EmployeeField
              label="Position"
              value={bundle.employee.position ?? "—"}
            />
            <EmployeeField
              label="Date hired"
              value={toDisplayDate(bundle.employee.date_hired)}
            />
          </div>
        </section>

        <Separator />

        <section aria-label="Detailed concerns" className="space-y-2">
          <Label htmlFor="pip-detailed-concerns">
            Detailed Areas for Improvement/Concern
          </Label>
          <Textarea
            id="pip-detailed-concerns"
            value={detailedConcerns}
            disabled={isReadOnly || saving}
            onChange={(event) => setDetailedConcerns(event.target.value)}
            placeholder="Describe the observed concerns and the expected standard"
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Printed on the PIP as the narrative behind the listed areas.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="pip-start-date">PIP start date</Label>
            <Input
              id="pip-start-date"
              type="date"
              value={startDate}
              disabled={isReadOnly || saving}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pip-end-date">PIP end date</Label>
            <Input
              id="pip-end-date"
              type="date"
              value={endDate}
              disabled={isReadOnly || saving}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pip-superior-id">Immediate superior ID</Label>
            <Input
              id="pip-superior-id"
              type="number"
              min={1}
              step={1}
              value={superiorId}
              disabled={isReadOnly || saving}
              onChange={(event) => setSuperiorId(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <Separator />

        <section aria-label="Action plan" className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Improvement and Action Plan</h3>
            <p className="text-xs text-muted-foreground">
              Each row links an area to its action plan. Review dates and
              results are recorded later, once the employee acknowledges this
              plan.
            </p>
          </div>
          {planRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No action-plan rows yet. Add the first improvement and its action
              plan.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-grid density-comfortable min-w-[640px]">
                <thead>
                  <tr>
                    <th scope="col">Area for improvement</th>
                    <th scope="col">Action plan</th>
                    <th scope="col">
                      <span className="sr-only">Row actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {planRows.map((row, index) => (
                    <tr key={row.key}>
                      <td className="min-w-44 align-top">
                        <Label
                          htmlFor={`pip-plan-area-${row.key}`}
                          className="sr-only"
                        >
                          {`Row ${index + 1} area for improvement`}
                        </Label>
                        <Input
                          id={`pip-plan-area-${row.key}`}
                          value={row.area}
                          disabled={isReadOnly || saving}
                          onChange={(event) =>
                            updateRow(row.key, { area: event.target.value })
                          }
                          placeholder="Area for improvement"
                        />
                      </td>
                      <td className="min-w-56 align-top">
                        <Label
                          htmlFor={`pip-plan-action-${row.key}`}
                          className="sr-only"
                        >
                          {`Row ${index + 1} action plan`}
                        </Label>
                        <Textarea
                          id={`pip-plan-action-${row.key}`}
                          value={row.action}
                          disabled={isReadOnly || saving}
                          onChange={(event) =>
                            updateRow(row.key, { action: event.target.value })
                          }
                          placeholder="Action plan"
                          rows={2}
                        />
                      </td>
                      <td className="align-top">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isReadOnly || saving}
                          onClick={() => removeRow(row.key)}
                          aria-label={`Remove action-plan row ${index + 1}`}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isReadOnly || saving}
            onClick={addRow}
          >
            Add row
          </Button>
        </section>

        <Separator />

        <section aria-label="Acknowledgement" className="space-y-2">
          <h3 className="text-sm font-semibold">Acknowledgement</h3>
          <div className="rounded-lg border border-border p-4 text-sm">
            {currentPip?.employee_acknowledged_at ? (
              <p>
                Acknowledged by the employee on{" "}
                <span className="tabular-nums">
                  {toDisplayDate(currentPip.employee_acknowledged_at)}
                </span>
                .
              </p>
            ) : currentPip?.employee_viewed_at ? (
              <p className="text-muted-foreground">
                Viewed by the employee on{" "}
                <span className="tabular-nums">
                  {toDisplayDate(currentPip.employee_viewed_at)}
                </span>
                , awaiting acknowledgement.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Read-only. The employee acknowledges in their own module once
                this PIP is saved.
              </p>
            )}
          </div>
        </section>

        {validationError && (currentPip || failedEvaluation) ? (
          <Alert>
            <AlertTitle>Check the form</AlertTitle>
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        ) : null}

        {saveError ? (
          <Alert variant="destructive">
            <AlertTitle>Save failed</AlertTitle>
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        ) : null}

        {!isReadOnly ? (
          <Button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            aria-disabled={!canSave}
          >
            {saving ? "Saving…" : currentPip ? "Save Changes" : "Save PIP"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
