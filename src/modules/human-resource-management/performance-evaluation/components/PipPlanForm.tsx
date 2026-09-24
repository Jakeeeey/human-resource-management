"use client";

import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Plus, Trash2 } from "lucide-react";

import {
  EvaluationClientError,
  createPip,
  getDepartmentSuperiors,
  updatePip,
} from "../providers/evaluationClient";
import type {
  CreatePipInput,
  DepartmentSuperior,
  UpdatePipInput,
} from "../providers/evaluationClient";
import type { WorkspaceBundle } from "../types/performance-evaluation.schema";
import { SingleDatePicker } from "./SingleDatePicker";
import { SuperiorCombobox } from "./SuperiorCombobox";

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
  backHref: string;
  readOnly?: boolean;
}): JSX.Element {
  const { scope, bundle, onSaved, backHref, readOnly = false } = props;

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
  const [roster, setRoster] = useState<DepartmentSuperior[] | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterReloadKey, setRosterReloadKey] = useState(0);

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

  useEffect(() => {
    let cancelled = false;
    setRoster(null);
    setRosterError(null);
    getDepartmentSuperiors(bundle.employee.user_id)
      .then((rows) => {
        if (cancelled) return;
        setRoster(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRosterError(
          err instanceof Error ? err.message : "Failed to load employees.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [bundle.employee.user_id, rosterReloadKey]);

  const departmentMembers = useMemo(() => {
    if (!roster) return null;
    return roster;
  }, [roster]);

  const superiorName = useMemo(() => {
    const trimmed = superiorId.trim();
    if (trimmed === "" || !departmentMembers) return null;
    const match = departmentMembers.find(
      (row) => `${row.user_id}` === trimmed,
    );
    return match ? match.full_name : null;
  }, [superiorId, departmentMembers]);

  const staleSuperiorId = useMemo(() => {
    const trimmed = superiorId.trim();
    if (trimmed === "" || !departmentMembers) return null;
    const known = departmentMembers.some(
      (row) => `${row.user_id}` === trimmed,
    );
    return known ? null : trimmed;
  }, [superiorId, departmentMembers]);

  const completedRows = useMemo(
    () =>
      planRows.filter(
        (row) => row.area.trim() !== "" && row.action.trim() !== "",
      ).length,
    [planRows],
  );

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
        <CardTitle className="text-base font-semibold">
          Performance Improvement Plan
        </CardTitle>
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

        <section aria-label="PIP timeline" className="space-y-3">
          <h3 className="text-sm font-semibold">PIP timeline</h3>
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="pip-start-date">PIP start date</Label>
              {isReadOnly ? (
                <p className="text-sm tabular-nums" id="pip-start-date">
                  {startDate === "" ? "Not set" : startDate}
                </p>
              ) : (
                <SingleDatePicker
                  id="pip-start-date"
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Pick a start date"
                  disabled={saving}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pip-end-date">PIP end date</Label>
              {isReadOnly ? (
                <p className="text-sm tabular-nums" id="pip-end-date">
                  {endDate === "" ? "Not set" : endDate}
                </p>
              ) : (
                <SingleDatePicker
                  id="pip-end-date"
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="Pick an end date"
                  disabled={saving}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pip-superior">Immediate superior</Label>
              {isReadOnly ? (
                <p className="text-sm" id="pip-superior">
                  {superiorId.trim() === ""
                    ? "Not assigned"
                    : (superiorName ?? `ID ${superiorId.trim()}`)}
                </p>
              ) : rosterError ? (
                <Alert variant="destructive">
                  <AlertTitle>Failed to load employees</AlertTitle>
                  <AlertDescription className="flex flex-wrap items-center gap-2">
                    <span>{rosterError}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRosterReloadKey((key) => key + 1)}
                    >
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : departmentMembers == null ? (
                <Skeleton className="h-10 w-full" aria-label="Loading employees" />
              ) : departmentMembers.length === 0 && staleSuperiorId == null ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  {bundle.employee.department_id == null
                    ? "No department is recorded for this employee, so there is no superior list to choose from."
                    : "There is no one else in this department to assign as the immediate superior."}
                </p>
              ) : (
                <>
                  <SuperiorCombobox
                    id="pip-superior"
                    options={[
                      { value: "", label: "No superior assigned" },
                      ...departmentMembers.map((row) => ({
                        value: `${row.user_id}`,
                        label: row.is_department_head
                          ? `${row.full_name} — Department head`
                          : row.full_name,
                      })),
                      ...(staleSuperiorId != null
                        ? [
                            {
                              value: staleSuperiorId,
                              label: `ID ${staleSuperiorId} — not in the current department list`,
                            },
                          ]
                        : []),
                    ]}
                    value={superiorId.trim()}
                    onValueChange={setSuperiorId}
                    placeholder="Select a superior"
                    disabled={saving}
                  />
                  <p className="text-xs text-muted-foreground">
                    Only members of the employee&apos;s own department can be
                    assigned.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        <Separator />

        <section aria-label="Action plan" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">
                  Improvement and Action Plan
                </h3>
                <StatusBadge tone="neutral">
                  {planRows.length === 1
                    ? "1 item"
                    : `${planRows.length} items`}
                </StatusBadge>
              </div>
              <p className="text-xs text-muted-foreground">
                Each row links an area to its action plan.
                {planRows.length === 0
                  ? " Start with the first improvement below."
                  : ` ${completedRows} of ${planRows.length} complete.`}{" "}
                Review dates and results are recorded later, once the employee
                acknowledges this plan.
              </p>
            </div>
          </div>
          {planRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
              <ClipboardList
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold">No improvements listed</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Name the first area that needs work and the action that will
                address it.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isReadOnly || saving}
                onClick={addRow}
              >
                <Plus aria-hidden="true" />
                Add the first improvement
              </Button>
            </div>
          ) : (
            <ol className="space-y-3">
              {planRows.map((row, index) => {
                return (
                  <li
                    key={row.key}
                    className="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow duration-150 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums"
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          Improvement {index + 1}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={isReadOnly || saving}
                        onClick={() => removeRow(row.key)}
                        aria-label={`Remove improvement ${index + 1}`}
                        title={`Remove improvement ${index + 1}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`pip-plan-area-${row.key}`}>
                          Area for improvement
                        </Label>
                        <Textarea
                          id={`pip-plan-area-${row.key}`}
                          value={row.area}
                          disabled={isReadOnly || saving}
                          onChange={(event) =>
                            updateRow(row.key, { area: event.target.value })
                          }
                          placeholder="e.g. On-time task delivery"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor={`pip-plan-action-${row.key}`}>
                          Action plan
                        </Label>
                        <Textarea
                          id={`pip-plan-action-${row.key}`}
                          value={row.action}
                          disabled={isReadOnly || saving}
                          onChange={(event) =>
                            updateRow(row.key, { action: event.target.value })
                          }
                          placeholder="What will be done, by whom, and how progress is checked"
                          rows={3}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {planRows.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              disabled={isReadOnly || saving}
              onClick={addRow}
            >
              <Plus aria-hidden="true" />
              Add improvement
            </Button>
          ) : null}
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

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 w-full sm:w-auto md:min-h-0"
            asChild
          >
            <Link href={backHref}>Back to workspace</Link>
          </Button>
          {!isReadOnly ? (
            <Button
              type="button"
              size="sm"
              className="min-h-11 w-full sm:w-auto md:min-h-0"
              disabled={!canSave}
              onClick={handleSave}
              aria-disabled={!canSave}
            >
              {saving ? "Saving…" : currentPip ? "Save Changes" : "Save PIP"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
