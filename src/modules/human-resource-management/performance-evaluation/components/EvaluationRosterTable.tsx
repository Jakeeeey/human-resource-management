"use client";

import {
  ChevronRight,
  CircleCheck,
  Clock,
  TriangleAlert,
  UserSearch,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { EvaluationScope } from "../providers/evaluationClient";
import type { RosterRow } from "../types/performance-evaluation.schema";
import { StatusPill, statusToneBadgeClass } from "./StatusPill";

export const EVALUATION_ROSTER_PAGE_SIZES = [10, 25, 50, 100] as const;

export function formatRosterDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return value;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type DeadlineTone = "overdue" | "soon" | "muted";
export type DueKey = "third" | "fifth" | "sixth";

const STAGE_ORDER: Record<string, number> = {
  first_evaluation: 0,
  pip_1: 1,
  second_evaluation: 2,
  pip_2: 3,
  recommendation: 4,
  regularization: 5,
  closed: 6,
};

const DUE_STAGE: Record<DueKey, number> = {
  third: 0,
  fifth: 2,
  sixth: 4,
};

const DUE_SOON_DAYS = 30;

function parseDueDate(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match === null) return null;
  if (
    match[1] === undefined ||
    match[2] === undefined ||
    match[3] === undefined
  ) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function dueValue(row: RosterRow, key: DueKey): string | null {
  if (key === "third") return row.third_month_due;
  if (key === "fifth") return row.fifth_month_due;
  return row.sixth_month_due;
}

export function deadlineToneFor(row: RosterRow, key: DueKey): DeadlineTone {
  const stageIndex = STAGE_ORDER[row.stage];
  if (stageIndex === undefined || stageIndex === 6) return "muted";
  if (DUE_STAGE[key] !== stageIndex) return "muted";
  const target = parseDueDate(dueValue(row, key));
  if (target === null) return "muted";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000
  );
  if (diffDays < 0 || row.is_overdue) return "overdue";
  if (diffDays <= DUE_SOON_DAYS) return "soon";
  return "muted";
}

export function attentionFor(row: RosterRow): "overdue" | "soon" | null {
  const keys: readonly DueKey[] = ["third", "fifth", "sixth"];
  let soon = false;
  for (const key of keys) {
    const tone = deadlineToneFor(row, key);
    if (tone === "overdue") return "overdue";
    if (tone === "soon") soon = true;
  }
  return soon ? "soon" : null;
}

const DEADLINE_TEXT: Record<DeadlineTone, string> = {
  overdue: "font-semibold text-destructive",
  soon: "font-medium text-[hsl(var(--warning))]",
  muted: "text-muted-foreground",
};

function displayText(value: string | null): string {
  return value && value.trim() !== "" ? value : "—";
}

function nextDueKeyFor(row: RosterRow): DueKey | null {
  const stageIndex = STAGE_ORDER[row.stage];
  if (stageIndex === undefined) return null;
  const keys: readonly DueKey[] = ["third", "fifth", "sixth"];
  for (const key of keys) {
    if (DUE_STAGE[key] === stageIndex) return key;
  }
  return null;
}

function NextDueDate({ row }: { row: RosterRow }) {
  const key = nextDueKeyFor(row);
  if (key === null)
    return <span className="tabular-nums whitespace-nowrap">—</span>;
  return (
    <span
      className={`tabular-nums whitespace-nowrap ${DEADLINE_TEXT[deadlineToneFor(row, key)]}`}
    >
      {formatRosterDate(dueValue(row, key))}
    </span>
  );
}

function AttentionBadge({ row }: { row: RosterRow }) {
  const attention = attentionFor(row);
  if (attention === "overdue")
    return (
      <StatusBadge
        tone="destructive"
        className={statusToneBadgeClass("destructive")}
      >
        <TriangleAlert aria-hidden="true" />
        Overdue
      </StatusBadge>
    );
  if (attention === "soon")
    return (
      <StatusBadge tone="warning" className={statusToneBadgeClass("warning")}>
        <Clock aria-hidden="true" />
        Due soon
      </StatusBadge>
    );
  return (
    <StatusBadge tone="neutral" className={statusToneBadgeClass("neutral")}>
      <CircleCheck aria-hidden="true" />
      On track
    </StatusBadge>
  );
}

function emptyCopy(scope: EvaluationScope, filtersActive: boolean) {
  if (filtersActive)
    return {
      title: "No employees match these filters",
      description: "Try a different search term or department.",
    };
  if (scope === "head")
    return {
      title: "No employees in your department",
      description:
        "Nobody in your department is on probation right now. New hires will appear here automatically.",
    };
  return {
    title: "No employees on probation",
    description:
      "Everyone has been regularized or separated. New hires will appear here automatically.",
  };
}

function RosterEmpty({
  scope,
  filtersActive,
  onClearFilters,
}: {
  scope: EvaluationScope;
  filtersActive: boolean;
  onClearFilters: () => void;
}) {
  const copy = emptyCopy(scope, filtersActive);
  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UserSearch aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{copy.title}</EmptyTitle>
        <EmptyDescription>{copy.description}</EmptyDescription>
      </EmptyHeader>
      {filtersActive ? (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

export function EvaluationRosterTable({
  rows,
  scope,
  activeUserId,
  onSelect,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  totalCount,
  filtersActive,
  onClearFilters,
}: {
  rows: readonly RosterRow[];
  scope: EvaluationScope;
  activeUserId: number | null;
  onSelect: (row: RosterRow) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  totalCount: number;
  filtersActive: boolean;
  onClearFilters: () => void;
}) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rangeStart = rows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, rows.length);
  const paged = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="density-comfortable">
      <div className="data-grid">
        <ul className="divide-y divide-border xl:hidden">
          {paged.length === 0 ? (
            <li>
              <RosterEmpty
                scope={scope}
                filtersActive={filtersActive}
                onClearFilters={onClearFilters}
              />
            </li>
          ) : (
            paged.map((row) => {
              const isActive = activeUserId === row.user_id;
              return (
                <li key={row.user_id}>
                  <button
                    type="button"
                    data-roster-row={row.user_id}
                    aria-label={`View evaluation details for ${row.full_name}`}
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => onSelect(row)}
                    className={cn(
                      "flex w-full flex-col gap-2.5 p-4 text-left transition-colors hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:-outline-offset-2",
                      isActive && "bg-accent hover:bg-accent"
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span
                          className="block truncate text-sm font-semibold"
                          title={row.full_name}
                        >
                          {row.full_name}
                        </span>
                        <span
                          className="block truncate text-xs text-muted-foreground"
                          title={row.position ?? ""}
                        >
                          {displayText(row.position)}
                        </span>
                      </span>
                      <ChevronRight
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StatusPill status={row.probation_status} />
                      <AttentionBadge row={row} />
                    </span>
                    <span className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <span className="min-w-0">
                        <span className="block text-muted-foreground">
                          Department
                        </span>
                        <span
                          className="block truncate font-medium"
                          title={row.department_name ?? ""}
                        >
                          {displayText(row.department_name)}
                        </span>
                      </span>
                      <span>
                        <span className="block text-muted-foreground">
                          Date hired
                        </span>
                        <span className="block font-medium whitespace-nowrap tabular-nums">
                          {formatRosterDate(row.date_hired)}
                        </span>
                      </span>
                      <span className="col-span-2 border-t border-border/50 pt-2">
                        <span className="mb-1 block text-muted-foreground">
                          Next due date
                        </span>
                        <NextDueDate row={row} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="hidden xl:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Date hired</TableHead>
                <TableHead>Next due date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attention</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <RosterEmpty
                      scope={scope}
                      filtersActive={filtersActive}
                      onClearFilters={onClearFilters}
                    />
                  </TableCell>
                </TableRow>
              )}
              {paged.map((row) => {
                const isActive = activeUserId === row.user_id;
                return (
                  <TableRow
                    key={row.user_id}
                    data-roster-row={row.user_id}
                    aria-label={`View evaluation details for ${row.full_name}`}
                    aria-selected={isActive}
                    tabIndex={0}
                    onClick={() => onSelect(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(row);
                      }
                    }}
                    className={cn(
                      "cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:-outline-offset-2",
                      isActive && "bg-accent hover:bg-accent"
                    )}
                  >
                    <TableCell>
                      <div
                        className="truncate text-sm font-semibold"
                        title={row.full_name}
                      >
                        {row.full_name}
                      </div>
                      <div
                        className="truncate text-xs text-muted-foreground"
                        title={row.position ?? ""}
                      >
                        {displayText(row.position)}
                      </div>
                    </TableCell>
                    <TableCell
                      className="max-w-44 truncate"
                      title={row.department_name ?? ""}
                    >
                      {displayText(row.department_name)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatRosterDate(row.date_hired)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <NextDueDate row={row} />
                    </TableCell>
                    <TableCell>
                      <StatusPill status={row.probation_status} />
                    </TableCell>
                    <TableCell>
                      <AttentionBadge row={row} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/50 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {rows.length === 0
              ? `Showing 0 of ${totalCount}`
              : `Showing ${rangeStart}-${rangeEnd} of ${rows.length} (total ${totalCount})`}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Rows per page
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => onPageSizeChange(Number(value))}
              >
                <SelectTrigger
                  size="sm"
                  className="w-[90px]"
                  aria-label="Rows per page"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVALUATION_ROSTER_PAGE_SIZES.map((size) => (
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
                onClick={() => onPageChange(safePage - 1)}
              >
                Previous
              </Button>
              <span
                className="text-xs tabular-nums text-muted-foreground"
                aria-live="polite"
              >
                {safePage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => onPageChange(safePage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
