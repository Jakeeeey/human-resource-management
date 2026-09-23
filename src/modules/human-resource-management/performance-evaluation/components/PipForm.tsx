"use client";

import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

function toDateInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function parsePlanResult(value: string): PlanResult {
  if (value === "met" || value === "partially_met" || value === "not_met") {
    return value;
  }
  return "";
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
          <Alert>
            <AlertTitle>No failed evaluation</AlertTitle>
            <AlertDescription>
              A PIP can only be opened from a failed evaluation. There is no
              failed evaluation without a PIP for this employee yet, so there
              is nothing to file.
            </AlertDescription>
          </Alert>
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
          <Badge variant="outline">{currentPip ? "Edit" : "Create"}</Badge>
          {currentPip ? (
            <Badge
              variant={currentPip.status === "failed" ? "destructive" : "secondary"}
            >
              {currentPip.status === "open"
                ? "Open"
                : currentPip.status === "passed"
                  ? "Passed"
                  : "Failed"}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isReadOnly ? (
          <Alert variant="destructive">
            <AlertTitle>PIP failed — read-only</AlertTitle>
            <AlertDescription>
              Once a PIP is failed the form becomes read-only and the employee
              is recorded as separated.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label>Areas for Improvement</Label>
          {areaRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No areas for improvement yet.
            </p>
          ) : (
            <div className="space-y-2">
              {areaRows.map((row) => (
                <div key={row.key} className="flex items-center gap-2">
                  <Input
                    value={row.name}
                    disabled={isReadOnly}
                    maxLength={150}
                    onChange={(event) =>
                      updateArea(row.key, event.target.value)
                    }
                    placeholder="Typed area for improvement"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isReadOnly}
                    onClick={() => removeArea(row.key)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={isReadOnly}
            onClick={addArea}
          >
            Add area
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pip-detailed-concerns">
            Detailed Areas for Improvement/Concern
          </Label>
          <Textarea
            id="pip-detailed-concerns"
            value={detailedConcerns}
            disabled={isReadOnly}
            onChange={(event) => setDetailedConcerns(event.target.value)}
            placeholder="Typed details of the areas for improvement"
            rows={4}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="pip-start-date">PIP Start Date</Label>
            <Input
              id="pip-start-date"
              type="date"
              value={startDate}
              disabled={isReadOnly}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pip-end-date">PIP End Date</Label>
            <Input
              id="pip-end-date"
              type="date"
              value={endDate}
              disabled={isReadOnly}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pip-superior-id">Immediate Superior ID</Label>
            <Input
              id="pip-superior-id"
              type="number"
              min={1}
              step={1}
              value={superiorId}
              disabled={isReadOnly}
              onChange={(event) => setSuperiorId(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Improvement and Action Plan Timeline</Label>
          {planRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No action-plan rows yet.
            </p>
          ) : (
            <div className="space-y-3">
              {planRows.map((row) => (
                <div
                  key={row.key}
                  className="space-y-3 rounded-lg border p-3"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`pip-area-${row.key}`}>
                      Area for improvement
                    </Label>
                    <Input
                      id={`pip-area-${row.key}`}
                      value={row.area}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        updateRow(row.key, { area: event.target.value })
                      }
                      placeholder="Area for improvement"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`pip-action-${row.key}`}>Action plan</Label>
                    <Textarea
                      id={`pip-action-${row.key}`}
                      value={row.action}
                      disabled={isReadOnly}
                      onChange={(event) =>
                        updateRow(row.key, { action: event.target.value })
                      }
                      placeholder="Typed action plan"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor={`pip-review-${row.key}`}>
                        Review date
                      </Label>
                      <Input
                        id={`pip-review-${row.key}`}
                        type="date"
                        value={row.reviewDate}
                        disabled={isReadOnly}
                        onChange={(event) =>
                          updateRow(row.key, { reviewDate: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`pip-result-${row.key}`}>Result</Label>
                      <Select
                        value={row.result === "" ? "unreviewed" : row.result}
                        disabled={isReadOnly}
                        onValueChange={(value) =>
                          updateRow(row.key, { result: parsePlanResult(value) })
                        }
                      >
                        <SelectTrigger
                          id={`pip-result-${row.key}`}
                          className="w-full"
                        >
                          <SelectValue placeholder="Not reviewed" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unreviewed">
                            Not reviewed
                          </SelectItem>
                          <SelectItem value="met">Met</SelectItem>
                          <SelectItem value="partially_met">
                            Partially met
                          </SelectItem>
                          <SelectItem value="not_met">Not met</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isReadOnly}
                        onClick={() => removeRow(row.key)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={isReadOnly}
            onClick={addRow}
          >
            Add Row
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Outcome — human verdict</Label>
          <p className="text-xs text-muted-foreground">
            Once the PIP is failed the form becomes read-only and the employee
            is recorded as separated.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={status === "passed" ? "default" : "outline"}
              disabled={isReadOnly}
              onClick={() => setStatus("passed")}
            >
              Pass
            </Button>
            <Button
              type="button"
              variant={status === "failed" ? "destructive" : "outline"}
              disabled={isReadOnly}
              onClick={() => setStatus("failed")}
            >
              Fail
            </Button>
          </div>
        </div>

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
          <Button type="button" disabled={!canSave} onClick={handleSave}>
            {saving ? "Saving…" : currentPip ? "Save Changes" : "Save PIP"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
