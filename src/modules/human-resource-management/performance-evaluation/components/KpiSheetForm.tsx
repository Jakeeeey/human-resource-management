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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

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

function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatScore(value: number): string {
  return `${Math.round(value * 100) / 100}`;
}

export function KpiSheetForm(props: {
  scope: "hr" | "head";
  userId: number;
  evalType: "first" | "second";
  bundle: WorkspaceBundle;
  onSaved: () => void;
}): JSX.Element {
  const { scope, userId, evalType, bundle, onSaved } = props;

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

  const [library, setLibrary] = useState<EvaluationCriterion[] | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  useEffect(() => {
    if (existing || voidBlocked) return;
    let cancelled = false;
    setLibraryLoading(true);
    setLibraryError(null);
    listKpiCriteria()
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
  }, [existing, voidBlocked]);

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
  const allRated =
    rows.length > 0 &&
    ratings.length === rows.length &&
    ratings.every((rating) => rating != null && rating >= 1 && rating <= 5);
  const canSave =
    !saving &&
    !voidBlocked &&
    rows.length > 0 &&
    allRated &&
    result != null &&
    weightsValid &&
    !unlinkedRow &&
    !libraryLoading;

  function handleRatingChange(index: number, raw: string): void {
    setRatings((prev) => {
      const next = [...prev];
      if (raw.trim() === "") {
        next[index] = null;
        return next;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return prev;
      next[index] = Math.min(5, Math.max(1, Math.round(parsed)));
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
          <Badge variant="secondary">
            {evalType === "first" ? "First Evaluation" : "Second Evaluation"}
          </Badge>
          <Badge variant="outline">
            {scope === "hr" ? "HR" : "Department Head"}
          </Badge>
          <Badge variant="outline">{existing ? "Edit" : "Create"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {voidBlocked ? (
          <Alert variant="destructive">
            <AlertTitle>Evaluation voided</AlertTitle>
            <AlertDescription>
              This evaluation has been voided and can no longer be edited.
            </AlertDescription>
          </Alert>
        ) : null}

        {libraryLoading ? <p className="text-sm">Loading KPI criteria…</p> : null}

        {libraryError ? (
          <Alert variant="destructive">
            <AlertTitle>Failed to load criteria</AlertTitle>
            <AlertDescription>{libraryError}</AlertDescription>
          </Alert>
        ) : null}

        {!libraryLoading && !libraryError && rows.length === 0 ? (
          <Alert>
            <AlertTitle>No KPI rows</AlertTitle>
            <AlertDescription>
              There are no active KPI criteria to rate yet.
            </AlertDescription>
          </Alert>
        ) : null}

        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Measurement Method</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead>Rating (1–5)</TableHead>
                  <TableHead className="text-right">Weighted Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => {
                  const rating = ratings[index] ?? null;
                  const weighted =
                    rating == null ? null : (rating * row.weight) / 100;
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">
                        {row.category}
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-pre-wrap">
                        {row.description}
                      </TableCell>
                      <TableCell>{row.target ?? "—"}</TableCell>
                      <TableCell>{row.method ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {formatScore(row.weight)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          step={1}
                          className="w-20"
                          aria-label={`Rating for ${row.category}`}
                          value={rating ?? ""}
                          onChange={(event) =>
                            handleRatingChange(index, event.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {weighted == null ? "—" : formatScore(weighted)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={6} className="font-semibold">
                    Total Score{" "}
                    {band ? (
                      <Badge variant="secondary" className="ml-2">
                        {band}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatScore(total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Weight total: {formatScore(weightSum)}
            {!allRated ? " — rate every row to complete the sheet." : null}
          </p>
        ) : null}

        {rows.length > 0 && !weightsValid ? (
          <Alert variant="destructive">
            <AlertTitle>Weights do not total 100</AlertTitle>
            <AlertDescription>
              The KPI library currently totals {formatScore(weightSum)}. Save
              will be rejected until the library totals 100.
            </AlertDescription>
          </Alert>
        ) : null}

        {unlinkedRow ? (
          <Alert variant="destructive">
            <AlertTitle>Unlinked row</AlertTitle>
            <AlertDescription>
              A row is missing its linked criterion and cannot be saved.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="kpi-evaluator-comments">Evaluator Comments</Label>
          <Textarea
            id="kpi-evaluator-comments"
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            placeholder="Typed evaluator comments"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label>Result — human verdict, never auto-computed</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={result === "passed" ? "default" : "outline"}
              onClick={() => setResult("passed")}
            >
              Pass
            </Button>
            <Button
              type="button"
              variant={result === "failed" ? "destructive" : "outline"}
              onClick={() => setResult("failed")}
            >
              Fail
            </Button>
          </div>
        </div>

        {saveError ? (
          <Alert variant="destructive">
            <AlertTitle>Save failed</AlertTitle>
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="button" disabled={!canSave} onClick={handleSave}>
          {saving ? "Saving…" : existing ? "Save Changes" : "Save Evaluation"}
        </Button>
      </CardContent>
    </Card>
  );
}
