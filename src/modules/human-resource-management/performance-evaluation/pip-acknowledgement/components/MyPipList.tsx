"use client";

import type { JSX } from "react";
import { ClipboardList, Eye, FileCheck2, RotateCcw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { EmployeePip } from "../types/performance-evaluation.schema";

export interface MyPipListProps {
  pips: EmployeePip[];
  loading: boolean;
  error: string | null;
  selectedPipId: number | null;
  onSelect: (pipId: number) => void;
  onRetry: () => void;
}

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

function isAcknowledged(pip: EmployeePip): boolean {
  return pip.employee_acknowledged_at !== null;
}

function PipListSkeleton(): JSX.Element {
  return (
    <div className="space-y-3">
      <div className="data-grid density-comfortable hidden overflow-hidden md:block">
        <div className="space-y-0">
          <Skeleton className="h-11 w-full rounded-none" />
          <Skeleton className="h-14 w-full rounded-none" />
          <Skeleton className="h-14 w-full rounded-none" />
          <Skeleton className="h-14 w-full rounded-none" />
        </div>
      </div>
      <div className="grid gap-3 md:hidden">
        {[0, 1].map((key) => (
          <Card key={key}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function MyPipList({
  pips,
  loading,
  error,
  selectedPipId,
  onSelect,
  onRetry,
}: MyPipListProps): JSX.Element {
  if (loading) {
    return <PipListSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Failed to load your improvement plans.</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (pips.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold">No improvement plans assigned to you.</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            When your manager places you on a plan, it will appear here for review and
            acknowledgement.
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto md:block">
        <Table className="data-grid density-comfortable">
          <TableHeader>
            <TableRow>
              <TableHead>PIP period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Viewed</TableHead>
              <TableHead>Acknowledgement</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pips.map((pip) => {
              const acknowledged = isAcknowledged(pip);
              return (
                <TableRow
                  key={pip.id}
                  data-state={selectedPipId === pip.id ? "selected" : undefined}
                >
                  <TableCell
                    className={
                      acknowledged ? "text-muted-foreground" : "font-medium tabular-nums"
                    }
                  >
                    {formatDay(pip.pip_start_date)} — {formatDay(pip.pip_end_date)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={pipStatusTone(pip.status)}>
                      {pipStatusLabel(pip.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {pip.employee_viewed_at ? formatStamp(pip.employee_viewed_at) : "Not viewed"}
                  </TableCell>
                  <TableCell>
                    {acknowledged ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                        <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatStamp(pip.employee_acknowledged_at)}
                      </span>
                    ) : (
                      <StatusBadge tone="warning">Action needed</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={acknowledged ? "outline" : "default"}
                      size="sm"
                      onClick={() => onSelect(pip.id)}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      {acknowledged ? "View" : "Review and acknowledge"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {pips.map((pip) => {
          const acknowledged = isAcknowledged(pip);
          return (
            <Card
              key={pip.id}
              className={acknowledged ? "bg-muted/30" : "border-primary/40 shadow-sm"}
            >
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={
                      acknowledged
                        ? "text-sm text-muted-foreground tabular-nums"
                        : "text-sm font-semibold tabular-nums"
                    }
                  >
                    {formatDay(pip.pip_start_date)} — {formatDay(pip.pip_end_date)}
                  </p>
                  <StatusBadge tone={pipStatusTone(pip.status)}>
                    {pipStatusLabel(pip.status)}
                  </StatusBadge>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground tabular-nums">
                  <p>
                    Viewed:{" "}
                    {pip.employee_viewed_at ? formatStamp(pip.employee_viewed_at) : "Not viewed"}
                  </p>
                  {acknowledged ? (
                    <p className="inline-flex items-center gap-1.5">
                      <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Acknowledged {formatStamp(pip.employee_acknowledged_at)}
                    </p>
                  ) : (
                    <StatusBadge tone="warning">Action needed</StatusBadge>
                  )}
                </div>
                <Button
                  variant={acknowledged ? "outline" : "default"}
                  size="sm"
                  className="w-full"
                  onClick={() => onSelect(pip.id)}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  {acknowledged ? "View PIP" : "Review and acknowledge"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
