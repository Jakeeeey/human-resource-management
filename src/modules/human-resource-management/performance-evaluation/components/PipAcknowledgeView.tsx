"use client";

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, Lock, RotateCcw, ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePipAcknowledgement } from "../hooks/usePipAcknowledgement";
import type {
  EmployeePip,
  EmployeePipActionPlan,
} from "../types/performance-evaluation.schema";

export interface PipAcknowledgeViewProps {
  pipId: number;
}

const ACK_STATEMENT =
  "I hereby acknowledge that I have received and discussed this Performance Improvement Plan with my Manager. I understand the expectations and actions outlined in this plan and that if these are not met, this may include termination of employment.";

const RESULT_LABELS: Record<NonNullable<EmployeePipActionPlan["result"]>, string> = {
  met: "Met",
  partially_met: "Partially met",
  not_met: "Not met",
};

const PLAN_PAGE_SIZE = 10;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatDay(value: string | null): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

function formatStamp(value: string | null): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return formatDay(value);
  const [, year, month, day, hourRaw, minute] = match;
  const hour = Number(hourRaw);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}, ${hour12}:${minute} ${suffix}`;
}

function pipStatusTone(status: EmployeePip["status"]): StatusTone {
  if (status === "passed") return "success";
  if (status === "failed") return "destructive";
  return "warning";
}

function pipStatusLabel(status: EmployeePip["status"]): string {
  if (status === "passed") return "Passed";
  if (status === "failed") return "Failed";
  return "Open";
}

function resultLabel(result: EmployeePipActionPlan["result"]): string {
  if (!result) return "—";
  return RESULT_LABELS[result];
}

function PipDetailSkeleton(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-9 w-48" />
        </CardContent>
      </Card>
    </div>
  );
}

export function PipAcknowledgeView({ pipId }: PipAcknowledgeViewProps): JSX.Element {
  const { pip, areas, actionPlans, loading, error, refresh, markViewed, acknowledge } =
    usePipAcknowledgement(pipId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [planPage, setPlanPage] = useState(1);
  const viewedOnceRef = useRef(false);

  useEffect(() => {
    if (viewedOnceRef.current) return;
    viewedOnceRef.current = true;
    void markViewed().catch(() => undefined);
  }, [markViewed]);

  useEffect(() => {
    setPlanPage(1);
  }, [pipId, actionPlans.length]);

  async function handleConfirm(): Promise<void> {
    setActionBusy(true);
    setActionError(null);
    try {
      await acknowledge();
      setConfirmOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to record acknowledgement.");
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <PipDetailSkeleton />;
  }

  if (error || !pip) {
    const accessDenied =
      error !== null && /403|forbidden|not have access|access denied/i.test(error);
    return (
      <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {accessDenied ? (
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              ) : (
                <FileText className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <p className="text-sm font-semibold">
              {accessDenied
                ? "You don't have access to this improvement plan."
                : "This improvement plan is not available."}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {accessDenied
                ? "This plan belongs to another employee, or your access was changed. If you believe this is a mistake, contact HR."
                : "It may have been removed, or you may not have access to it. If you believe this is a mistake, contact HR."}
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void refresh()}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const acknowledged = pip.employee_acknowledged_at !== null;
  const period = `${formatDay(pip.pip_start_date)} — ${formatDay(pip.pip_end_date)}`;
  const sortedAreas = [...areas].sort((a, b) => a.sort_order - b.sort_order);
  const sortedPlans = [...actionPlans].sort((a, b) => a.sort_order - b.sort_order);
  const planTotalPages = Math.max(1, Math.ceil(sortedPlans.length / PLAN_PAGE_SIZE));
  const safePlanPage = Math.min(Math.max(1, planPage), planTotalPages);
  const planRangeStart =
    sortedPlans.length === 0 ? 0 : (safePlanPage - 1) * PLAN_PAGE_SIZE + 1;
  const planRangeEnd = Math.min(safePlanPage * PLAN_PAGE_SIZE, sortedPlans.length);
  const pagedPlans = sortedPlans.slice(
    (safePlanPage - 1) * PLAN_PAGE_SIZE,
    safePlanPage * PLAN_PAGE_SIZE
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Performance Improvement Plan
              </p>
              <CardTitle className="text-xl tabular-nums">{period}</CardTitle>
            </div>
            <StatusBadge tone={pipStatusTone(pip.status)}>
              {pipStatusLabel(pip.status)}
            </StatusBadge>
          </div>
          <CardDescription className="grid grid-cols-1 gap-1 text-xs tabular-nums sm:grid-cols-2">
            <span>
              Viewed: {pip.employee_viewed_at ? formatStamp(pip.employee_viewed_at) : "Not viewed"}
            </span>
            <span>
              Acknowledged:{" "}
              {pip.employee_acknowledged_at
                ? formatStamp(pip.employee_acknowledged_at)
                : "Pending"}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Separator />
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Areas for improvement</h3>
            {sortedAreas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No areas recorded.</p>
            ) : (
              <ul className="space-y-2">
                {sortedAreas.map((area) => (
                  <li
                    key={area.id}
                    className="flex cursor-default items-start gap-3 rounded-[var(--radius)] border bg-card px-3 py-2"
                  >
                    <Checkbox checked={area.selected} disabled aria-label={area.area_name_snapshot} />
                    <span
                      className={
                        area.selected ? "text-sm font-medium" : "text-sm text-muted-foreground"
                      }
                    >
                      {area.area_name_snapshot}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Separator />
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Detailed concerns</h3>
            {pip.detailed_concerns ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {pip.detailed_concerns}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No details recorded.</p>
            )}
          </section>
          <Separator />
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Improvement and action plan timeline</h3>
            {sortedPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No action plans recorded.</p>
            ) : (
              <div className="space-y-2">
                <ul className="space-y-2 sm:hidden">
                  {pagedPlans.map((plan) => (
                    <li
                      key={plan.id}
                      className="space-y-1 rounded-[var(--radius)] border bg-card px-3 py-2"
                    >
                      <p className="text-sm font-medium">{plan.area_for_improvement}</p>
                      <p className="text-sm text-muted-foreground">{plan.action_plan ?? "—"}</p>
                      <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                        <span>{formatDay(plan.review_date)}</span>
                        <span>{resultLabel(plan.result)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="hidden max-h-[560px] overflow-auto sm:block">
                  <Table className="data-grid density-compact">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Area for improvement</TableHead>
                        <TableHead>Action plan</TableHead>
                        <TableHead>Review date</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedPlans.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium">{plan.area_for_improvement}</TableCell>
                          <TableCell>{plan.action_plan ?? "—"}</TableCell>
                          <TableCell className="tabular-nums">
                            {formatDay(plan.review_date)}
                          </TableCell>
                          <TableCell>{resultLabel(plan.result)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {planTotalPages > 1 ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                      Showing {planRangeStart}–{planRangeEnd} of {sortedPlans.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePlanPage <= 1}
                        onClick={() => setPlanPage(safePlanPage - 1)}
                      >
                        Previous
                      </Button>
                      <span
                        className="text-xs text-muted-foreground tabular-nums"
                        aria-live="polite"
                      >
                        {safePlanPage} of {planTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePlanPage >= planTotalPages}
                        onClick={() => setPlanPage(safePlanPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {acknowledged ? (
              <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
            )}
            Acknowledgement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <blockquote className="rounded-[var(--radius)] border bg-muted/40 px-4 py-3 text-sm leading-relaxed">
            {ACK_STATEMENT}
          </blockquote>
          {acknowledged ? (
            <div className="space-y-2 rounded-[var(--radius)] border bg-muted/40 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="success">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Acknowledged
                </StatusBadge>
                <p className="text-sm font-semibold tabular-nums">
                  Acknowledged on {formatStamp(pip.employee_acknowledged_at)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                This acknowledgement is on record and cannot be changed.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                onClick={() => {
                  setActionError(null);
                  setConfirmOpen(true);
                }}
              >
                Review and acknowledge
              </Button>
              <p className="text-xs text-muted-foreground">
                You will be asked to confirm after reading the full statement.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Acknowledge this improvement plan</DialogTitle>
            <DialogDescription className="tabular-nums">{period}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              You are acknowledging the plan for <strong>{period}</strong>. Please read the
              statement below in full before confirming.
            </p>
            <blockquote className="rounded-[var(--radius)] border bg-muted/40 px-4 py-3 text-sm leading-relaxed">
              {ACK_STATEMENT}
            </blockquote>
            <p className="text-xs text-muted-foreground">
              Confirming records your acknowledgement permanently with today&apos;s date. This
              cannot be undone.
            </p>
            {actionError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Failed to record acknowledgement.</AlertTitle>
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={actionBusy} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button disabled={actionBusy} onClick={() => void handleConfirm()}>
              {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {actionBusy ? "Recording…" : "I have read and acknowledge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
