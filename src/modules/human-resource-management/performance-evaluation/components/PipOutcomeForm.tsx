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
import { cn } from "@/lib/utils";

import {
  EvaluationClientError,
  updatePip,
} from "../providers/evaluationClient";
import type { UpdatePipInput } from "../providers/evaluationClient";
import type { WorkspaceBundle } from "../types/performance-evaluation.schema";
import {
  canRecordOutcome,
  incompleteOutcomeIndices,
  reviewDateInRange,
} from "../utils/pipGuards";

type PlanResult = "met" | "partially_met" | "not_met" | "";

type OutcomeRow = {
  key: string;
  planId: number;
  pipAreaId: number | null;
  area: string;
  action: string;
  reviewDate: string;
  result: PlanResult;
};

type PipStatus = "open" | "passed" | "failed";

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

function pipStatusTone(status: PipStatus): "warning" | "success" | "destructive" {
  if (status === "passed") return "success";
  if (status === "failed") return "destructive";
  return "warning";
}

function pipStatusLabel(status: PipStatus): string {
  if (status === "passed") return "PIP passed";
  if (status === "failed") return "Separated";
  return "PIP in progress";
}

export function PipOutcomeForm(props: {
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

  const storedAreas = useMemo(() => {
    if (!currentPip) return [];
    return bundle.pipAreas
      .filter((area) => area.pip_id === currentPip.id)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [bundle.pipAreas, currentPip]);

  const [rowsSeed, setRowsSeed] = useState<number | "">("");
  const [rows, setRows] = useState<OutcomeRow[]>([]);
  const [statusSeed, setStatusSeed] = useState<number | "">("");
  const [status, setStatus] = useState<PipStatus>("open");

  useEffect(() => {
    const seed = currentPip ? currentPip.id : "";
    if (seed === rowsSeed) return;
    setRowsSeed(seed);
    setRows(
      storedPlans.map((plan) => ({
        key: `plan-${plan.id}`,
        planId: plan.id,
        pipAreaId: plan.pip_area_id,
        area: plan.area_for_improvement,
        action: plan.action_plan ?? "",
        reviewDate: toDateInput(plan.review_date),
        result: plan.result ?? "",
      })),
    );
  }, [currentPip, storedPlans, rowsSeed]);

  useEffect(() => {
    const seed = currentPip ? currentPip.id : "";
    if (seed === statusSeed) return;
    setStatusSeed(seed);
    setStatus(currentPip ? currentPip.status : "open");
  }, [currentPip, statusSeed]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const viewerLocked = readOnly;

  if (!currentPip) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Performance Improvement Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm font-semibold">No PIP to evaluate</p>
            <p className="text-sm text-muted-foreground">
              Outcomes can only be recorded on an agreed plan. Create the PIP
              plan first.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (currentPip.status === "open" && currentPip.employee_acknowledged_at == null) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-semibold">
              Performance Improvement Plan
            </CardTitle>
            <StatusBadge tone="warning">PIP in progress</StatusBadge>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTitle>Awaiting employee acknowledgement</AlertTitle>
            <AlertDescription>
              The outcome form unlocks after the employee acknowledges this PIP
              plan. Ratings and the overall outcome cannot be recorded before
              then.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const closed = currentPip.status !== "open";
  const isReadOnly = closed || viewerLocked;
  const outcomeAllowed = canRecordOutcome({
    status: currentPip.status,
    employeeAcknowledgedAt: currentPip.employee_acknowledged_at,
  });

  function updateRow(key: string, patch: Partial<OutcomeRow>): void {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function validate(pip: { pip_start_date: string | null; pip_end_date: string | null } | null): string | null {
    if (!outcomeAllowed) return null;
    const missing = incompleteOutcomeIndices(
      rows.map((row) => ({
        reviewDate: row.reviewDate === "" ? null : row.reviewDate,
        result: row.result === "" ? null : row.result,
      })),
    );
    if (missing.length > 0) {
      return `Rows ${missing.map((index) => index + 1).join(", ")} still need a review date and a result.`;
    }
    for (const row of rows) {
      if (
        !reviewDateInRange(
          row.reviewDate === "" ? null : row.reviewDate,
          pip?.pip_start_date ?? null,
          pip?.pip_end_date ?? null,
        )
      ) {
        return "Every review date must fall within the PIP start and end dates.";
      }
    }
    if (status !== "passed" && status !== "failed") {
      return "Choose an overall outcome — pass or fail — set explicitly by the department head.";
    }
    return null;
  }

  const validationError = validate(currentPip);
  const canSave =
    !saving && !isReadOnly && outcomeAllowed && validationError == null;

  function resolveSaveError(err: unknown): string {
    if (err instanceof EvaluationClientError) {
      if (err.status === 403) {
        return "The server refused the outcome update. The PIP may still be awaiting employee acknowledgement.";
      }
      if (err.status === 400) {
        return `The server rejected the outcome: ${err.message}`;
      }
      return err.message;
    }
    if (err instanceof Error) return err.message;
    return "Saving failed. Please try again.";
  }

  async function handleSave(): Promise<void> {
    if (!currentPip) return;
    const problem = validate(currentPip);
    if (problem) {
      setSaveError(problem);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const input: UpdatePipInput = {
        action_plan: rows.map((row) => ({
          pip_area_id: row.pipAreaId,
          review_date: row.reviewDate === "" ? null : row.reviewDate,
          result: row.result === "" ? null : row.result,
        })),
        status,
      };
      await updatePip(currentPip.id, input);
      onSaved();
    } catch (err: unknown) {
      setSaveError(resolveSaveError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base font-semibold">
            Performance Improvement Plan
          </CardTitle>
          <StatusBadge tone={pipStatusTone(currentPip.status)}>
            {pipStatusLabel(currentPip.status)}
          </StatusBadge>
        </div>
        <p className="text-xs text-muted-foreground">
          {bundle.employee.full_name}
          {bundle.employee.department_name
            ? ` · ${bundle.employee.department_name}`
            : null}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {viewerLocked && !closed ? (
          <Alert>
            <AlertTitle>
              {scope === "hr" ? "Awaiting the department head" : "Awaiting HR"}
            </AlertTitle>
            <AlertDescription>
              The department head owns this PIP step. You can review the agreed
              plan and outcome below, but only the department head can submit
              them.
            </AlertDescription>
          </Alert>
        ) : null}
        {closed ? (
          <Alert variant={currentPip.status === "failed" ? "destructive" : "default"}>
            <AlertTitle>
              {currentPip.status === "failed"
                ? "PIP failed — read-only"
                : "PIP passed — read-only"}
            </AlertTitle>
            <AlertDescription>
              {currentPip.status === "failed"
                ? "Once a PIP is failed the form becomes read-only and the employee is recorded as separated."
                : "This PIP is closed. The agreed plan and recorded outcome below are read-only."}
            </AlertDescription>
          </Alert>
        ) : null}

        <section aria-label="Agreed plan" className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Agreed Plan</h3>
            <p className="text-xs text-muted-foreground">
              Acknowledged by the employee on{" "}
              <span className="tabular-nums">
                {toDisplayDate(currentPip.employee_acknowledged_at)}
              </span>{" "}
              ·{" "}
              <span className="tabular-nums">
                {toDisplayDate(currentPip.pip_start_date)}
              </span>{" "}
              to{" "}
              <span className="tabular-nums">
                {toDisplayDate(currentPip.pip_end_date)}
              </span>
              .
            </p>
          </div>
          {currentPip.detailed_concerns ? (
            <p className="rounded-lg border border-border p-4 text-sm">
              {currentPip.detailed_concerns}
            </p>
          ) : null}
          {storedAreas.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {storedAreas.map((area) => (
                <li key={area.id}>
                  <StatusBadge tone="neutral">
                    {area.area_name_snapshot}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          ) : null}
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This PIP has no action-plan rows.
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
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.key}>
                      <td className="min-w-44 align-top text-sm">
                        {row.area}
                      </td>
                      <td className="min-w-56 align-top text-sm text-muted-foreground">
                        {row.action === "" ? "—" : row.action}
                      </td>
                      <td className="align-top">
                        <Label
                          htmlFor={`pip-outcome-review-${row.key}`}
                          className="sr-only"
                        >
                          {`Row ${index + 1} review date`}
                        </Label>
                        <Input
                          id={`pip-outcome-review-${row.key}`}
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
                          htmlFor={`pip-outcome-result-${row.key}`}
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
                            id={`pip-outcome-result-${row.key}`}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Separator />

        <section
          aria-label="PIP outcome"
          className="space-y-2 rounded-lg border border-border p-4"
        >
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Outcome — human verdict</h3>
            <p className="text-xs text-muted-foreground">
              Set explicitly by the department head. Once the PIP is failed the
              form becomes read-only and the employee is recorded as separated.
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

        {validationError && outcomeAllowed && !isReadOnly ? (
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

        {!isReadOnly && outcomeAllowed ? (
          <Button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            aria-disabled={!canSave}
          >
            {saving ? "Saving…" : "Save Outcome"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
