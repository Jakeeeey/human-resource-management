"use client";

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

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
  return "info";
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
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
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
  const viewedOnceRef = useRef(false);

  useEffect(() => {
    if (viewedOnceRef.current) return;
    viewedOnceRef.current = true;
    void markViewed().catch(() => undefined);
  }, [markViewed]);

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
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>This Performance Improvement Plan is not available.</AlertTitle>
            {error ? <AlertDescription>{error}</AlertDescription> : null}
          </Alert>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const acknowledged = pip.employee_acknowledged_at !== null;
  const sortedAreas = [...areas].sort((a, b) => a.sort_order - b.sort_order);
  const sortedPlans = [...actionPlans].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Performance Improvement Plan</CardTitle>
              <CardDescription>
                {formatDay(pip.pip_start_date)} — {formatDay(pip.pip_end_date)}
              </CardDescription>
            </div>
            <StatusBadge tone={pipStatusTone(pip.status)}>
              {pipStatusLabel(pip.status)}
            </StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <p>Viewed: {pip.employee_viewed_at ? formatStamp(pip.employee_viewed_at) : "Not viewed"}</p>
          <p>
            Acknowledged:{" "}
            {pip.employee_acknowledged_at ? formatStamp(pip.employee_acknowledged_at) : "Pending"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Areas for Improvement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedAreas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No areas recorded.</p>
          ) : (
            sortedAreas.map((area) => (
              <label
                key={area.id}
                className="flex cursor-default items-start gap-3 rounded-lg border px-3 py-2"
              >
                <Checkbox checked={area.selected} disabled aria-label={area.area_name_snapshot} />
                <span
                  className={
                    area.selected ? "text-sm font-medium" : "text-sm text-muted-foreground"
                  }
                >
                  {area.area_name_snapshot}
                </span>
              </label>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detailed Areas for Improvement / Concern</CardTitle>
        </CardHeader>
        <CardContent>
          {pip.detailed_concerns ? (
            <p className="whitespace-pre-wrap text-sm">{pip.detailed_concerns}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No details recorded.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Improvement and Action Plan Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No action plans recorded.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Area for Improvement</TableHead>
                    <TableHead>Action Plan</TableHead>
                    <TableHead>Review Date</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.area_for_improvement}</TableCell>
                      <TableCell>{plan.action_plan ?? "—"}</TableCell>
                      <TableCell>{formatDay(plan.review_date)}</TableCell>
                      <TableCell>{resultLabel(plan.result)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acknowledgement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{ACK_STATEMENT}</p>
          <Separator />
          {acknowledged ? (
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
              Acknowledged on {formatStamp(pip.employee_acknowledged_at)}
            </p>
          ) : (
            <Button
              onClick={() => {
                setActionError(null);
                setConfirmOpen(true);
              }}
            >
              Acknowledge PIP
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Acknowledge Performance Improvement Plan</DialogTitle>
            <DialogDescription>{ACK_STATEMENT}</DialogDescription>
          </DialogHeader>
          {actionError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Failed to record acknowledgement.</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={actionBusy} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button disabled={actionBusy} onClick={() => void handleConfirm()}>
              {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              I acknowledge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
