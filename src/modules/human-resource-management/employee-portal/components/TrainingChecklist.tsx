"use client";

import { useState } from "react";
import { AlertCircle, ListChecks } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateLong } from "@/lib/utils";

import {
  PORTAL_TRAINING_STATUS_LABELS,
  type PortalTrainingItem,
  type PortalTrainingStatus,
} from "../types/portal-training.schema";

import { PortalTablePagination } from "./PortalTablePagination";

interface TrainingChecklistProps {
  items: PortalTrainingItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

const STATUS_BADGE_CLASS: Record<PortalTrainingStatus, string> = {
  pending: "border-border text-muted-foreground",
  in_progress: "border-sky-500/40 text-sky-600",
  done: "border-emerald-500/40 text-emerald-600",
  blocked: "border-rose-500/40 text-rose-600",
  na: "border-border text-muted-foreground",
};

function formatDueDate(value: string | null): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "—";
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateLong(date);
}

export function TrainingChecklist({
  items,
  isLoading,
  isError,
  error,
}: TrainingChecklistProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const filteredCount = items.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = filteredCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filteredCount);
  const pagedItems = items.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl shrink-0">
          <ListChecks className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold truncate">
            Training checklist
          </h2>
          <p className="text-sm text-muted-foreground">
            Training the hub expects you to complete.
          </p>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load your training</AlertTitle>
          <AlertDescription>{error?.message ?? "Fetch failed"}</AlertDescription>
        </Alert>
      )}

      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Training item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <div className="space-y-2 py-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                      <p className="text-muted-foreground">
                        No training assigned yet.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        HR adds training as your onboarding progresses.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pagedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell
                      className="max-w-[320px] truncate font-medium"
                      title={item.title}
                    >
                      {item.title}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_BADGE_CLASS[item.status]}
                      >
                        {PORTAL_TRAINING_STATUS_LABELS[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDueDate(item.dueDate)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <PortalTablePagination
          page={currentPage}
          pageSize={pageSize}
          totalPages={totalPages}
          filteredCount={filteredCount}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>
    </section>
  );
}
