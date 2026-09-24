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
import { cn } from "@/lib/utils";

import {
  EvaluationClientError,
  createEvaluation,
  listKpiCriteria,
  updateEvaluation,
} from "../providers/evaluationClient";
import type {
  CreateEvaluationInput,
  UpdateEvaluationInput,
} from "../providers/evaluationClient";
import type {
  EvaluationCriterion,
  WorkspaceBundle,
} from "../types/performance-evaluation.schema";
import {
  computeTotalScore,
  isWeightSetValid,
  ratingBand,
  sumWeights,
} from "../utils/kpiScore";

type KpiRow = {
  key: string;
  criterionId: number | null;
  category: string;
  description: string;
  target: string | null;
  method: string | null;
  weight: number;
};

type EvalResult = "passed" | "failed";

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatScore(value: number): string {
  return `${Math.round(value * 100) / 100}`;
}

function bandTone(band: string | null): "success" | "info" | "warning" | "destructive" | "neutral" {
  if (band === "Outstanding" || band === "Very Good") return "success";
  if (band === "Satisfactory") return "info";
  if (band === "Needs Improvement") return "warning";
  if (band === "Unsatisfactory") return "destructive";
  return "neutral";
}

function RatingSelector(props: {
  rowLabel: string;
  value: number | null;
  disabled: boolean;
  onSelect: (rating: number) => void;
  onClear: () => void;
}): JSX.Element {
  const { rowLabel, value, disabled, onSelect, onClear } = props;
  return (
    <div className="flex flex-col gap-1">
      <div
        role="radiogroup"
        aria-label={`Rating for ${rowLabel}, 1 to 5`}
        className="inline-flex items-center gap-1"
      >
        {RATING_OPTIONS.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${option} out of 5`}
              disabled={disabled}
              onClick={() => onSelect(option)}
              onKeyDown={(event) => {
                if (event.key === "Delete" || event.key === "Backspace") {
                  event.preventDefault();
                  onClear();
                }
              }}
              className={cn(
                "h-8 w-8 rounded-md border text-sm font-semibold tabular-nums transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {value == null ? "Not rated" : `Rated ${value} of 5`}
      </span>
    </div>
  );
}

export function KpiSheetForm(props: {
  scope: "hr" | "head";
  userId: number;
  evalType: "first" | "second";
  bundle: WorkspaceBundle;
  onSaved: () => void;
  readOnly?: boolean;
}): JSX.Element {
  const { scope, userId, evalType, bundle, onSaved, readOnly = false } = props;
  const viewerLocked = readOnly;

  const newestOfType = useMemo(() => {
    const matches = bundle.evaluations
      .filter((entry) => entry.eval_type === evalType)
      .sort((a, b) => b.id - a.id);
    return matches.length > 0 ? matches[0] : null;
  }, [bundle.evaluations, evalType]);

  const existing =
    newestOfType && newestOfType.voided_at == null ? newestOfType : null;
  const voidBlocked = newestOfType != null && newestOfType.voided_at != null;

  const existingItems = useMemo(() => {
    if (!existing) return [];
    return bundle.evaluationItems
      .filter((item) => item.evaluation_id === existing.id)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [bundle.evaluationItems, existing]);

  const departmentId = bundle.employee.department_id ?? undefined;

  const [library, setLibrary] = useState<EvaluationCriterion[] | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (existing || voidBlocked) return;
    let cancelled = false;
    setLibraryLoading(true);
    setLibraryError(null);
    listKpiCriteria(false, departmentId)
      .then((rows) => {
        if (cancelled) return;
        setLibrary(rows);
        setLibraryLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLibraryLoading(false);
        setLibraryError(
          err instanceof Error ? err.message : "Failed to load KPI criteria.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [existing, voidBlocked, departmentId, reloadKey]);

  const rows: KpiRow[] = useMemo(() => {
    if (existing) {
      return existingItems.map((item) => ({
        key: `item-${item.id}`,
        criterionId: item.criterion_id,
        category: item.kpi_category_snapshot,
        description: item.kpi_description_snapshot,
        target: item.target_snapshot,
        method: item.measurement_method_snapshot,
        weight: item.weight_percentage_snapshot,
      }));
    }
    if (!library) return [];
    return [...library]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((criterion) => ({
        key: `criterion-${criterion.id}`,
        criterionId: criterion.id,
        category: criterion.kpi_category,
        description: criterion.kpi_description,
        target: criterion.target,
        method: criterion.measurement_method,
        weight: criterion.weight_percentage,
      }));
  }, [existing, existingItems, library]);

  const rowsSeed = rows.map((row) => row.key).join("|");
  const [ratingsSeed, setRatingsSeed] = useState("");
  const [ratings, setRatings] = useState<(number | null)[]>([]);

  useEffect(() => {
    if (rowsSeed === ratingsSeed) return;
    setRatingsSeed(rowsSeed);
    if (existing) {
      setRatings(existingItems.map((item) => item.rating));
    } else {
      setRatings(rows.map(() => null));
    }
  }, [rowsSeed, ratingsSeed, existing, existingItems, rows]);

  const [result, setResult] = useState<EvalResult | null>(null);
  const [comments, setComments] = useState("");
  const [metaSeed, setMetaSeed] = useState<number | "new">("new");

  useEffect(() => {
    const seed = existing ? existing.id : "new";
    if (seed === metaSeed) return;
    setMetaSeed(seed);
    setResult(existing ? existing.result : null);
    setComments(existing?.evaluator_comments ?? "");
  }, [existing, metaSeed]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const scoreItems = useMemo(
    () =>
      rows.map((row, index) => ({
        rating: ratings[index] ?? 0,
        weight_percentage_snapshot: row.weight,
      })),
    [rows, ratings],
  );
  const total = computeTotalScore(scoreItems);
  const band = ratingBand(total);

  const weightItems = useMemo(
    () => rows.map((row) => ({ weight_percentage_snapshot: row.weight })),
    [rows],
  );
  const weightSum = sumWeights(weightItems);
  const weightsValid = isWeightSetValid(weightItems);

  const unlinkedRow = rows.some((row) => row.criterionId == null);
  const libraryEmpty =
    !existing && !voidBlocked && !libraryLoading && !libraryError && rows.length === 0;
  const allRated =
    rows.length > 0 &&
    ratings.length === rows.length &&
    ratings.every((rating) => rating != null && rating >= 1 && rating <= 5);
  const canSave =
    !saving &&
    !voidBlocked &&
    !viewerLocked &&
    !libraryEmpty &&
    rows.length > 0 &&
    allRated &&
    result != null &&
    weightsValid &&
    !unlinkedRow &&
    !libraryLoading;

  function handleRatingSelect(index: number, rating: number): void {
    setRatings((prev) => {
      const next = [...prev];
      next[index] = rating;
      return next;
    });
  }

  function handleRatingClear(index: number): void {
    setRatings((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  function resolveSaveError(err: unknown): string {
    if (err instanceof EvaluationClientError) {
      if (err.status === 409) {
        return "An evaluation for this period already exists. Reload the workspace to edit it instead.";
      }
      if (err.status === 400) {
        return `The server rejected the ratings: ${err.message}`;
      }
      return err.message;
    }
    if (err instanceof Error) return err.message;
    return "Saving failed. Please try again.";
  }

  async function handleSave(): Promise<void> {
    if (result == null || !allRated) return;
    const payloadRatings: { criterion_id: number; rating: number }[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rating = ratings[index];
      if (row.criterionId == null || rating == null) {
        setSaveError(
          "A row is missing its linked criterion and cannot be saved.",
        );
        return;
      }
      payloadRatings.push({ criterion_id: row.criterionId, rating });
    }
    setSaving(true);
    setSaveError(null);
    try {
      const trimmedComments = comments.trim();
      if (existing) {
        const input: UpdateEvaluationInput = {
          result,
          evaluator_comments: trimmedComments === "" ? null : trimmedComments,
          ratings: payloadRatings,
        };
        await updateEvaluation(existing.id, input);
      } else {
        const input: CreateEvaluationInput = {
          user_id: userId,
          eval_type: evalType,
          evaluation_date: todayIso(),
          result,
          evaluator_comments: trimmedComments === "" ? null : trimmedComments,
          ratings: payloadRatings,
        };
        await createEvaluation(input);
      }
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
            KPI Rating Sheet
          </CardTitle>
          <StatusBadge tone="info">
            {evalType === "first" ? "First Evaluation" : "Second Evaluation"}
          </StatusBadge>
          <StatusBadge tone="neutral">
            {scope === "hr" ? "HR" : "Department Head"}
          </StatusBadge>
          <StatusBadge tone="neutral">{existing ? "Edit" : "Draft"}</StatusBadge>
        </div>
        <p className="text-xs text-muted-foreground">
          {bundle.employee.full_name}
          {bundle.employee.department_name
            ? ` · ${bundle.employee.department_name}`
            : null}{" "}
          · Criteria from the employee&apos;s department library
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {viewerLocked ? (
          <Alert>
            <AlertTitle>
              {scope === "hr"
                ? "Awaiting the department head"
                : "Awaiting HR"}
            </AlertTitle>
            <AlertDescription>
              {scope === "hr"
                ? "The department head owns this evaluation step. You can review the scores, band, result, and comments below, but only the department head can submit them."
                : "HR owns this step. You can review the scores, band, result, and comments below, but only HR can submit them."}
            </AlertDescription>
          </Alert>
        ) : null}

        {voidBlocked ? (
          <Alert variant="destructive">
            <AlertTitle>Evaluation voided</AlertTitle>
            <AlertDescription>
              This evaluation has been voided and can no longer be edited.
            </AlertDescription>
          </Alert>
        ) : null}

        {libraryLoading ? (
          <div className="space-y-2" aria-label="Loading KPI criteria">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : null}

        {libraryError ? (
          <Alert variant="destructive">
            <AlertTitle>Failed to load criteria</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <span>{libraryError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {libraryEmpty ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm font-semibold">No KPI rows</p>
            <p className="text-sm text-muted-foreground">
              There are no active KPI criteria in this employee&apos;s
              department library yet. The department head populates the library
              before an evaluation can be recorded.
            </p>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/hrm/department-evaluation/criteria">
                Open evaluation criteria
              </Link>
            </Button>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <section aria-label="KPI scorecard" className="space-y-3">
            <div className="max-h-[60vh] overflow-auto">
              <table className="data-grid density-comfortable min-w-[880px]">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-muted">KPI Category</th>
                    <th scope="col">Description</th>
                    <th scope="col">Target</th>
                    <th scope="col">Measurement Method</th>
                    <th scope="col" className="td-num">
                      Weight
                    </th>
                    <th scope="col">Rating (1–5)</th>
                    <th scope="col" className="td-num">
                      Weighted Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const rating = ratings[index] ?? null;
                    const weighted =
                      rating == null ? null : (rating * row.weight) / 100;
                    return (
                      <tr key={row.key}>
                        <td className="sticky left-0 bg-card font-medium">{row.category}</td>
                        <td className="max-w-xs whitespace-pre-wrap">
                          {row.description}
                        </td>
                        <td className="text-muted-foreground">
                          {row.target ?? "—"}
                        </td>
                        <td className="text-muted-foreground">
                          {row.method ?? "—"}
                        </td>
                        <td className="td-num tabular-nums">
                          {formatScore(row.weight)}
                        </td>
                        <td>
                          <RatingSelector
                            rowLabel={row.category}
                            value={rating}
                            disabled={voidBlocked || saving || viewerLocked}
                            onSelect={(next) =>
                              handleRatingSelect(index, next)
                            }
                            onClear={() => handleRatingClear(index)}
                          />
                        </td>
                        <td className="td-num tabular-nums">
                          {weighted == null ? "—" : formatScore(weighted)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!allRated && !voidBlocked ? (
              <p className="text-xs text-muted-foreground">
                Rate every row from 1 to 5 to complete the sheet.
              </p>
            ) : null}
          </section>
        ) : null}

        {rows.length > 0 ? (
          <section
            aria-label="Live total"
            className="sticky bottom-0 z-10 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">
                  Total Score
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatScore(total)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={bandTone(allRated ? band : null)}>
                    {allRated ? (band ?? "Unrated") : "Incomplete"}
                  </StatusBadge>
                  <StatusBadge tone={weightsValid ? "success" : "warning"}>
                    Weights {formatScore(weightSum)}
                    {weightsValid ? " · totals 100" : " · must total 100"}
                  </StatusBadge>
                </div>
              </div>
              <p className="max-w-sm text-xs text-muted-foreground">
                Computed live from rating × weight. The band describes the
                score — it is not the verdict below.
              </p>
            </div>
            {!weightsValid ? (
              <Alert variant="destructive" className="mt-3">
                <AlertTitle>Weights do not total 100</AlertTitle>
                <AlertDescription>
                  The department&apos;s library currently totals{" "}
                  {formatScore(weightSum)}. Save will be rejected until the
                  library totals 100.
                </AlertDescription>
              </Alert>
            ) : null}
          </section>
        ) : null}

        {unlinkedRow ? (
          <Alert variant="destructive">
            <AlertTitle>Unlinked row</AlertTitle>
            <AlertDescription>
              A row is missing its linked criterion and cannot be saved.
            </AlertDescription>
          </Alert>
        ) : null}

        <Separator />

        {libraryEmpty ? null : (
        <div className="space-y-2">
          <Label htmlFor="kpi-evaluator-comments">Evaluator comments</Label>
          <Textarea
            id="kpi-evaluator-comments"
            value={comments}
            disabled={voidBlocked || saving || viewerLocked}
            onChange={(event) => setComments(event.target.value)}
            placeholder="Observations, strengths, and concerns supporting the verdict"
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Saved with the evaluation and shown in the history card.
          </p>
        </div>
        )}

        {libraryEmpty ? null : (
        <section
          aria-label="Evaluation result"
          className="space-y-2 rounded-lg border border-border p-4"
        >
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Result — human verdict</h3>
            <p className="text-xs text-muted-foreground">
              Decided by the evaluator, never auto-computed from the score.
            </p>
          </div>
          {viewerLocked ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Verdict:</span>
              {result ? (
                <StatusBadge tone={result === "passed" ? "success" : "destructive"}>
                  {result === "passed" ? "Pass" : "Fail"}
                </StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Not recorded yet</StatusBadge>
              )}
            </div>
          ) : (
          <div
            role="radiogroup"
            aria-label="Evaluation result"
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={result === "passed"}
              disabled={voidBlocked || saving}
              onClick={() => setResult("passed")}
              className={cn(
                "rounded-md border p-3 text-left transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
                result === "passed"
                  ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              <span className="block text-sm font-semibold">Pass</span>
              <span
                className={cn(
                  "block text-xs",
                  result === "passed"
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                Proceeds to the next workflow stage
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={result === "failed"}
              disabled={voidBlocked || saving}
              onClick={() => setResult("failed")}
              className={cn(
                "rounded-md border p-3 text-left transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
                result === "failed"
                  ? "border-transparent bg-destructive text-destructive-foreground shadow-sm"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              <span className="block text-sm font-semibold">Fail</span>
              <span
                className={cn(
                  "block text-xs",
                  result === "failed"
                    ? "text-destructive-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                Opens a performance improvement plan
              </span>
            </button>
          </div>
          )}
        </section>
        )}

        {saveError ? (
          <Alert variant="destructive">
            <AlertTitle>Save failed</AlertTitle>
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        ) : null}

        {!voidBlocked && !viewerLocked && !libraryEmpty ? (
          <Button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            aria-disabled={!canSave}
          >
            {saving ? "Saving…" : existing ? "Save Changes" : "Save Evaluation"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
