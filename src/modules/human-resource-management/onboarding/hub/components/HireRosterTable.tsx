"use client";

import { AlertCircle, ChevronRight } from "lucide-react";

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

import {
  formatDueDate,
  isDateOverdue,
  OWNER_ROLE_LABELS,
  phaseLabel,
  ROSTER_STATUS_LABELS,
  rosterStatusTone,
} from "../rosterData";
import type { HireRosterRow } from "../types/hire-roster.schema";

// HireRosterTable.tsx — the roster MASTER pane (todo 27): the six plan columns
// (hire, status/phase, next action, owner, due, blockers). Presentational only
// — selection and filtering are owned by `HireRoster`. Below `xl` it renders a
// stacked card list so every decision column stays visible at rest
// (S6#3/S7#1); the six-column table (min-w-[900px]) only renders once the
// content column can actually hold it (S7 NEW-1: the sidebar leaves ~392px at
// 768px, so `sm` was too early).

/** Current phase plus ITS OWN required-task fraction (never the overall count). */
function phaseSummary(row: HireRosterRow): string {
  const current = row.phase
    ? row.phaseProgress.find((progress) => progress.phase === row.phase)
    : undefined;
  const base = phaseLabel(row.phase);
  return current && current.total > 0
    ? `${base} · ${current.done}/${current.total}`
    : base;
}

function nextActionLabel(row: HireRosterRow): string {
  if (!row.nextAction) return "All required tasks done";
  return row.nextAction.blocked
    ? `${row.nextAction.label} (blocked)`
    : row.nextAction.label;
}

export function HireRosterTable({
  rows,
  activeRow,
  onSelect,
}: {
  rows: readonly HireRosterRow[];
  activeRow: HireRosterRow | null;
  onSelect: (row: HireRosterRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      {/* Below xl: stacked cards so all six columns are readable at rest. */}
      <ul className="h-[560px] divide-y divide-border overflow-auto xl:hidden">
        {rows.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            No hires match these filters.
          </li>
        ) : (
          rows.map((row) => {
            const isActive = activeRow === row;
            const overdue = isDateOverdue(row.dueDate);
            return (
              <li key={row.userId}>
                <button
                  type="button"
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => onSelect(row)}
                  className={cn(
                    "flex w-full flex-col gap-2 px-4 py-3 text-left",
                    isActive && "bg-primary/5"
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {row.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        #{row.userId}
                      </span>
                    </span>
                    <ChevronRight
                      className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={rosterStatusTone(row.status)}>
                      {ROSTER_STATUS_LABELS[row.status]}
                    </StatusBadge>
                    <span className="text-xs text-muted-foreground">
                      {phaseSummary(row)}
                    </span>
                  </span>
                  <span className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span className="col-span-2">
                      <span className="text-muted-foreground">Next: </span>
                      <span className="font-medium">{nextActionLabel(row)}</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Owner: </span>
                      {row.ownerRole ? OWNER_ROLE_LABELS[row.ownerRole] : "—"}
                    </span>
                    <span className={cn(overdue && "font-medium text-destructive")}>
                      <span className="text-muted-foreground">Due: </span>
                      {formatDueDate(row.dueDate)}
                    </span>
                    {row.blockers.length > 0 ? (
                      <span className="col-span-2 flex items-center gap-1 text-destructive">
                        <AlertCircle
                          className="h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {row.blockers.length} blocked
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      {/* xl+: the six-column table once the content column can hold it. */}
      <div className="hidden h-[560px] overflow-auto xl:block">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="max-w-56">Hire</TableHead>
              <TableHead className="max-w-44">Status / Phase</TableHead>
              <TableHead className="max-w-64">Next action</TableHead>
              <TableHead className="max-w-32">Owner</TableHead>
              <TableHead className="max-w-36">Due</TableHead>
              <TableHead className="max-w-48">Blockers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No hires match these filters.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => {
              const isActive = activeRow === row;
              const overdue = isDateOverdue(row.dueDate);
              return (
                <TableRow
                  key={row.userId}
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
                    "cursor-pointer",
                    isActive &&
                      "border-primary/30 bg-primary/5 hover:bg-primary/10"
                  )}
                >
                  <TableCell className="max-w-56">
                    <div className="truncate font-medium" title={row.name}>
                      {row.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      #{row.userId}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-44">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge tone={rosterStatusTone(row.status)}>
                        {ROSTER_STATUS_LABELS[row.status]}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {phaseSummary(row)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell
                    className="max-w-64 truncate"
                    title={row.nextAction?.label ?? ""}
                  >
                    {nextActionLabel(row)}
                  </TableCell>
                  <TableCell
                    className="max-w-32 truncate"
                    title={row.ownerRole ? OWNER_ROLE_LABELS[row.ownerRole] : ""}
                  >
                    {row.ownerRole ? OWNER_ROLE_LABELS[row.ownerRole] : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "max-w-36 truncate",
                      overdue && "font-medium text-destructive"
                    )}
                    title={row.dueDate ?? ""}
                  >
                    {formatDueDate(row.dueDate)}
                  </TableCell>
                  <TableCell className="max-w-48">
                    {row.blockers.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className="flex items-center gap-1 text-sm text-destructive"
                        title={row.blockers
                          .map((blocker) => blocker.label)
                          .join("\n")}
                      >
                        <AlertCircle
                          className="h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          {row.blockers.length} blocked
                        </span>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
