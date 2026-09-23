"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EvaluationClientError } from "../providers/evaluationClient";
import type { EvaluationCriterion } from "../types/performance-evaluation.schema";
import { isWeightSetValid, sumWeights } from "../utils/kpiScore";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

interface KpiCriteriaTableProps {
  rows: readonly EvaluationCriterion[];
  loading: boolean;
  error: string | null;
  editable: boolean;
  readOnlyNote: string;
  onCreate: () => void;
  onEdit: (row: EvaluationCriterion) => void;
  onRemove: (id: number) => Promise<void>;
  onReorder: (order: { id: number; sort_order: number }[]) => Promise<void>;
  onRetry: () => void;
}

function sortedRows(rows: readonly EvaluationCriterion[]): EvaluationCriterion[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export function KpiCriteriaTable({
  rows,
  loading,
  error,
  editable,
  readOnlyNote,
  onCreate,
  onEdit,
  onRemove,
  onReorder,
  onRetry,
}: KpiCriteriaTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EvaluationCriterion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const ordered = useMemo(() => sortedRows(rows), [rows]);
  const activeWeightItems = useMemo(
    () =>
      ordered
        .filter((row) => row.is_active)
        .map((row) => ({ weight_percentage_snapshot: row.weight_percentage })),
    [ordered],
  );
  const activeWeightTotal = sumWeights(activeWeightItems);
  const weightsBalanced = isWeightSetValid(activeWeightItems);
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const rangeStart = ordered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, ordered.length);
  const visible = ordered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const move = async (row: EvaluationCriterion, direction: -1 | 1) => {
    const index = ordered.findIndex((entry) => entry.id === row.id);
    const neighbor = ordered[index + direction];
    if (index < 0 || !neighbor) return;
    const next = [...ordered];
    next[index] = neighbor;
    next[index + direction] = row;
    setMovingId(row.id);
    setMoveError(null);
    try {
      await onReorder(next.map((entry, position) => ({ id: entry.id, sort_order: (position + 1) * 10 })));
    } catch (err) {
      setMoveError(err instanceof EvaluationClientError ? err.message : "Failed to reorder the KPI criteria.");
    } finally {
      setMovingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onRemove(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      if (err instanceof EvaluationClientError && err.status === 409) {
        setDeleteError("This criterion is referenced by existing evaluation records and cannot be deleted.");
      } else {
        setDeleteError(err instanceof EvaluationClientError ? err.message : "Failed to delete the criterion.");
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Failed to load the KPI criteria</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <Button onClick={onCreate}>
              <Plus className="size-4" />
              Add criterion
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{readOnlyNote}</p>
          )}
          <StatusBadge tone={weightsBalanced ? "success" : "warning"}>
            <span aria-live="polite">Active weight total: {activeWeightTotal}%</span>
          </StatusBadge>
          {!weightsBalanced && (
            <p className="text-sm text-muted-foreground">
              Active criteria must total 100% before an evaluation can be created.
            </p>
          )}
        </div>

        {moveError && (
          <Alert variant="destructive">
            <AlertDescription>{moveError}</AlertDescription>
          </Alert>
        )}

        {ordered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No KPI criteria yet.
          </p>
        ) : (
          <div className="density-comfortable">
            <div className="data-grid">
              <div className="overflow-x-auto">
                <Table className="min-w-[880px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col" className="w-16">Order</TableHead>
                      <TableHead scope="col">KPI Category</TableHead>
                      <TableHead scope="col">Description</TableHead>
                      <TableHead scope="col">Target</TableHead>
                      <TableHead scope="col">Measurement Method</TableHead>
                      <TableHead scope="col" className="td-num w-24">Weight %</TableHead>
                      <TableHead scope="col" className="w-24">Active</TableHead>
                      {editable && (
                        <TableHead scope="col" className="w-36 text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((row) => {
                      const position = ordered.findIndex((entry) => entry.id === row.id);
                      const isFirst = position === 0;
                      const isLast = position === ordered.length - 1;
                      const busy = movingId === row.id;
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="td-num text-muted-foreground">{row.sort_order}</TableCell>
                          <TableCell className="font-medium">{row.kpi_category}</TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block max-w-64 cursor-default truncate text-muted-foreground">
                                  {row.kpi_description}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs whitespace-pre-wrap">{row.kpi_description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.target && row.target.trim() !== "" ? row.target : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.measurement_method && row.measurement_method.trim() !== "" ? row.measurement_method : "—"}
                          </TableCell>
                          <TableCell className="td-num font-medium">{row.weight_percentage}</TableCell>
                          <TableCell>
                            <StatusBadge tone={row.is_active ? "success" : "neutral"}>
                              {row.is_active ? "Active" : "Inactive"}
                            </StatusBadge>
                          </TableCell>
                          {editable && (
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Move ${row.kpi_category} up`}
                                  disabled={busy || isFirst}
                                  onClick={() => void move(row, -1)}
                                >
                                  <ArrowUp className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Move ${row.kpi_category} down`}
                                  disabled={busy || isLast}
                                  onClick={() => void move(row, 1)}
                                >
                                  <ArrowDown className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Edit ${row.kpi_category}`}
                                  onClick={() => onEdit(row)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Delete ${row.kpi_category}`}
                                  onClick={() => {
                                    setDeleteError(null);
                                    setDeleteTarget(row);
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {ordered.length === 0
                    ? "No rows to show"
                    : `Showing ${rangeStart}–${rangeEnd} of ${ordered.length}`}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page</span>
                    <Select value={String(pageSize)} onValueChange={(value) => changePageSize(Number(value))}>
                      <SelectTrigger size="sm" className="w-[90px]" aria-label="Rows per page">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setPage(safePage - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground" aria-live="polite">
                      Page {safePage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage(safePage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this criterion?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `“${deleteTarget.kpi_category}” will be permanently removed from the KPI library.`
                : "This criterion will be permanently removed from the KPI library."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={(event) => {
              event.preventDefault();
              void confirmDelete();
            }}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
