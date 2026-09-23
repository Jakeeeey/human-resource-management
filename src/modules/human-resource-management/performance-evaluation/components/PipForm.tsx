"use client";

import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  EvaluationClientError,
  createPip,
  updatePip,
} from "../providers/evaluationClient";
import type {
  CreatePipInput,
  UpdatePipInput,
} from "../providers/evaluationClient";
import type {
  WorkspaceBundle,
} from "../types/performance-evaluation.schema";

type AreaRow = {
  key: string;
  name: string;
};

type PlanResult = "met" | "partially_met" | "not_met" | "";

type PlanRow = {
  key: string;
  pipAreaId: number | null;
  area: string;
  action: string;
  reviewDate: string;
  result: PlanResult;
};

type PipStatus = "open" | "passed" | "failed";

const AREA_NAME_LIMIT = 150;

const PLAN_RESULT_LABELS: Record<Exclude<PlanResult, "">, string> = {
  met: "Met",
  partially_met: "Partially met",
  not_met: "Not met",
};

function toDateInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function toDisplayDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

function parsePlanResult(value: string): PlanResult {
  if (value === "met" || value === "partially_met" || value === "not_met") {
    return value;
  }
  return "";
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

export function PipForm(props: {
  userId: number;
  bundle: WorkspaceBundle;
  onSaved: () => void;
}): JSX.Element {
  const { userId, bundle, onSaved } = props;

  const currentPip = useMemo(() => {
    if (bundle.pips.length === 0) return null;
    return [...bundle.pips].sort((a, b) => b.id - a.id)[0];
  }, [bundle.pips]);

  const storedAreas = useMemo(() => {
    if (!currentPip) return [];
    return bundle.pipAreas
      .filter((area) => area.pip_id === currentPip.id)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [bundle.pipAreas, currentPip]);

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

  const [areasSeed, setAreasSeed] = useState<number | "new" | "">("");
  const [areaRows, setAreaRows] = useState<AreaRow[]>([]);
  const [areaCounter, setAreaCounter] = useState(0);

  useEffect(() => {
    const seed = currentPip ? currentPip.id : "new";
    if (seed === areasSeed) return;
    setAreasSeed(seed);
    if (currentPip) {
      const seeded = storedAreas.map((area) => ({
        key: `area-${area.id}`,
        name: area.area_name_snapshot,
      }));
      if (seeded.length > 0) {
        setAreaRows(seeded);
        setAreaCounter(seeded.length);
      } else {
        setAreaRows([{ key: "area-new-0", name: "" }]);
        setAreaCounter(1);
      }
    } else {
      setAreaRows([{ key: "area-new-0", name: "" }]);
      setAreaCounter(1);
    }
  }, [currentPip, storedAreas, areasSeed]);

  const [fieldsSeed, setFieldsSeed] = useState<number | "new" | "">("");
  const [detailedConcerns, setDetailedConcerns] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [superiorId, setSuperiorId] = useState("");
  const [status, setStatus] = useState<PipStatus>("open");
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
    setStatus(currentPip ? currentPip.status : "open");
    setPlanRows(
      storedPlans.map((plan) => ({
        key: `plan-${plan.id}`,
        pipAreaId: plan.pip_area_id,
        area: plan.area_for_improvement,
        action: plan.action_plan ?? "",
        reviewDate: toDateInput(plan.review_date),
        result: plan.result ?? "",
      })),
    );
  }, [currentPip, storedPlans, fieldsSeed]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isReadOnly = currentPip?.status === "failed";

  function updateArea(key: string, name: string): void {
    setAreaRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, name } : row)),
    );
  }

  function addArea(): void {
    const key = `area-new-${areaCounter}`;
    setAreaCounter((count) => count + 1);
    setAreaRows((prev) => [...prev, { key, name: "" }]);
  }

  function removeArea(key: string): void {
    setAreaRows((prev) => prev.filter((row) => row.key !== key));
  }

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
      { key, pipAreaId: null, area: "", action: "", reviewDate: "", result: "" },
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
      if (row.area.trim() === "") {
        return "Every action-plan row needs an area for improvement.";
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
      const areas = areaRows
        .map((row) => row.name.trim())
        .filter((name) => name !== "");
      const actionPlan = planRows.map((row) => ({
        pip_area_id: row.pipAreaId,
        area_for_improvement: row.area.trim(),
        action_plan: row.action.trim() === "" ? null : row.action,
        review_date: row.reviewDate === "" ? null : row.reviewDate,
        result: row.result === "" ? null : row.result,
      }));
      if (currentPip) {
        const input: UpdatePipInput = {
          pip_start_date: startDate === "" ? null : startDate,
          pip_end_date: endDate === "" ? null : endDate,
          immediate_superior_id:
            trimmedSuperior === "" ? null : Number(trimmedSuperior),
          detailed_concerns: trimmedConcerns === "" ? null : trimmedConcerns,
          areas,
          action_plan: actionPlan,
          status,
        };
        await updatePip(currentPip.id, input);
      } else {
        if (!failedEvaluation) {
          setSaveError("There is no failed evaluation to attach this PIP to.");
          return;
        }
        const input: CreatePipInput = {
          user_id: userId,
          evaluation_id: failedEvaluation.id,
          pip_start_date: startDate === "" ? null : startDate,
          pip_end_date: endDate === "" ? null : endDate,
          immediate_superior_id:
            trimmedSuperior === "" ? null : Number(trimmedSuperior),
          detailed_concerns: trimmedConcerns === "" ? null : trimmedConcerns,
          areas,
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
            {currentPip ? "Edit" : "Create"}
          </StatusBadge>
          {currentPip ? (
            <StatusBadge
              tone={
                currentPip.status === "failed"
                  ? "destructive"
                  : currentPip.status === "passed"
                    ? "success"
                    : "warning"
              }
            >
              {currentPip.status === "open"
                ? "PIP in progress"
                : currentPip.status === "passed"
                  ? "PIP passed"
                  : "Separated"}
            </StatusBadge>
          ) : (
            <StatusBadge tone="warning">PIP in progress</StatusBadge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {bundle.employee.full_name}
          {bundle.employee.department_name
            ? ` · ${bundle.employee.department_name}`
            : null}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {isReadOnly ? (
          <Alert variant="destructive">
            <AlertTitle>PIP failed — read-only</AlertTitle>
            <AlertDescription>
              Once a PIP is failed the form becomes read-only and the employee
              is recorded as separated.
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

        <section aria-label="Areas for improvement" className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Areas for Improvement</h3>
            <p className="text-xs text-muted-foreground">
              Short labels, up to {AREA_NAME_LIMIT} characters each. Blank rows
              are dropped on save.
            </p>
          </div>
          {areaRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No areas listed yet. Add the first area the employee must improve
              on.
            </p>
          ) : (
            <ul className="space-y-2">
              {areaRows.map((row, index) => (
                <li key={row.key} className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`pip-area-name-${row.key}`} className="sr-only">
                      {`Area ${index + 1}`}
                    </Label>
                    <Input
                      id={`pip-area-name-${row.key}`}
                      value={row.name}
                      disabled={isReadOnly || saving}
                      maxLength={AREA_NAME_LIMIT}
                      onChange={(event) =>
                        updateArea(row.key, event.target.value)
                      }
                      placeholder={`Area ${index + 1} — e.g. Attendance and punctuality`}
                      aria-describedby={`pip-area-count-${row.key}`}
                    />
                    <p
                      id={`pip-area-count-${row.key}`}
                      className="text-xs tabular-nums text-muted-foreground"
                    >
                      {row.name.length}/{AREA_NAME_LIMIT}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isReadOnly || saving}
                    onClick={() => removeArea(row.key)}
                    aria-label={`Remove area ${index + 1}`}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isReadOnly || saving}
            onClick={addArea}
          >
            Add area
          </Button>
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

        <section aria-label="Action plan timeline" className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">
              Improvement and Action Plan Timeline
            </h3>
            <p className="text-xs text-muted-foreground">
              Each row links an area to its action plan, review date, and
              result.
            </p>
          </div>
          {planRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No action-plan rows yet. Add the first improvement and its action
              plan.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-grid density-comfortable min-w-[860px]">
                <thead>
                  <tr>
                    <th scope="col">Area for improvement</th>
                    <th scope="col">Action plan</th>
                    <th scope="col">Review date</th>
                    <th scope="col">Result</th>
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
                        <Label
                          htmlFor={`pip-plan-review-${row.key}`}
                          className="sr-only"
                        >
                          {`Row ${index + 1} review date`}
                        </Label>
                        <Input
                          id={`pip-plan-review-${row.key}`}
                          type="date"
                          value={row.reviewDate}
                          disabled={isReadOnly || saving}
                          onChange={(event) =>
                            updateRow(row.key, {
                              reviewDate: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="min-w-36 align-top">
                        <Label
                          htmlFor={`pip-plan-result-${row.key}`}
                          className="sr-only"
                        >
                          {`Row ${index + 1} result`}
                        </Label>
                        <Select
                          value={row.result === "" ? "unreviewed" : row.result}
                          disabled={isReadOnly || saving}
                          onValueChange={(value) =>
                            updateRow(row.key, { result: parsePlanResult(value) })
                          }
                        >
                          <SelectTrigger
                            id={`pip-plan-result-${row.key}`}
                            className="w-full"
                          >
                            <SelectValue placeholder="Not reviewed" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unreviewed">
                              Not reviewed
                            </SelectItem>
                            <SelectItem value="met">
                              {PLAN_RESULT_LABELS.met}
                            </SelectItem>
                            <SelectItem value="partially_met">
                              {PLAN_RESULT_LABELS.partially_met}
                            </SelectItem>
                            <SelectItem value="not_met">
                              {PLAN_RESULT_LABELS.not_met}
                            </SelectItem>
                          </SelectContent>
                        </Select>
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

        <section
          aria-label="PIP outcome"
          className="space-y-2 rounded-lg border border-border p-4"
        >
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Outcome — human verdict</h3>
            <p className="text-xs text-muted-foreground">
              Once the PIP is failed the form becomes read-only and the
              employee is recorded as separated.
            </p>
          </div>
          <div
            role="radiogroup"
            aria-label="PIP outcome"
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={status === "passed"}
              disabled={isReadOnly || saving}
              onClick={() => setStatus("passed")}
              className={cn(
                "rounded-md border p-3 text-left transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
                status === "passed"
                  ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              <span className="block text-sm font-semibold">Pass</span>
              <span
                className={cn(
                  "block text-xs",
                  status === "passed"
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                Employee met the improvement plan
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={status === "failed"}
              disabled={isReadOnly || saving}
              onClick={() => setStatus("failed")}
              className={cn(
                "rounded-md border p-3 text-left transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
                status === "failed"
                  ? "border-transparent bg-destructive text-destructive-foreground shadow-sm"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              <span className="block text-sm font-semibold">Fail</span>
              <span
                className={cn(
                  "block text-xs",
                  status === "failed"
                    ? "text-destructive-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                Locks the form; employee recorded as separated
              </span>
            </button>
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
