"use client";

import type { JSX } from "react";
import { Eye } from "lucide-react";

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
  return "info";
}

function pipStatusLabel(status: EmployeePip["status"]): string {
  if (status === "passed") return "Passed";
  if (status === "failed") return "Failed";
  return "Open";
}

function PipListSkeleton(): JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-5/6" />
      </CardContent>
    </Card>
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
        <AlertTitle>Failed to load your PIPs.</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (pips.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          You have no Performance Improvement Plans.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-sm md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">PIP Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Viewed</TableHead>
              <TableHead>Acknowledged</TableHead>
              <TableHead className="pr-6 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pips.map((pip) => (
              <TableRow key={pip.id} data-state={selectedPipId === pip.id ? "selected" : undefined}>
                <TableCell className="pl-6 font-medium">
                  {formatDay(pip.pip_start_date)} — {formatDay(pip.pip_end_date)}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={pipStatusTone(pip.status)}>
                    {pipStatusLabel(pip.status)}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {pip.employee_viewed_at ? formatStamp(pip.employee_viewed_at) : "Not viewed"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {pip.employee_acknowledged_at
                    ? formatStamp(pip.employee_acknowledged_at)
                    : "Pending"}
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <Button variant="outline" size="sm" onClick={() => onSelect(pip.id)}>
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {pips.map((pip) => (
          <Card key={pip.id}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {formatDay(pip.pip_start_date)} — {formatDay(pip.pip_end_date)}
                </p>
                <StatusBadge tone={pipStatusTone(pip.status)}>
                  {pipStatusLabel(pip.status)}
                </StatusBadge>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Viewed: {pip.employee_viewed_at ? formatStamp(pip.employee_viewed_at) : "Not viewed"}</p>
                <p>
                  Acknowledged:{" "}
                  {pip.employee_acknowledged_at
                    ? formatStamp(pip.employee_acknowledged_at)
                    : "Pending"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onSelect(pip.id)}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                View PIP
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
