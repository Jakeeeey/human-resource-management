"use client";

import { ChevronRight } from "lucide-react";

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
  formatHiredDate,
  phaseLabel,
  ROSTER_STATUS_LABELS,
  rosterStatusTone,
} from "../rosterData";
import type { HireRosterRow } from "../types/hire-roster.schema";

// HireRosterTable.tsx — the roster MASTER pane (todo 27): the hire, its
// status/phase, and the employee's date of hire. Presentational only
// — selection and filtering are owned by `HireRoster`. Below `xl` it renders a
// stacked card list so every column stays visible at rest
// (S6#3/S7#1); the table (min-w-[560px]) only renders once the content column
// can actually hold it (S7 NEW-1: the sidebar leaves ~392px at 768px, so `sm`
// was too early).

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

export function HireRosterTable({
  rows,
  activeRow,
  onSelect,
  unfilteredCount,
}: {
  rows: readonly HireRosterRow[];
  activeRow: HireRosterRow | null;
  onSelect: (row: HireRosterRow) => void;
  unfilteredCount?: number;
}) {
  const total = unfilteredCount ?? rows.length;
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      {/* Below xl: stacked cards so every column is readable at rest. */}
      <ul className="max-h-[560px] divide-y divide-border overflow-auto xl:hidden">
        {rows.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            No hires match these filters.
          </li>
        ) : (
          rows.map((row) => {
            const isActive = activeRow === row;
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
                    <span className="block min-w-0 truncate font-medium">
                      {row.name}
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
                  <span className="text-xs">
                    <span className="text-muted-foreground">Date hired: </span>
                    <span className="font-medium">
                      {formatHiredDate(row.dateHired)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      {/* xl+: the table once the content column can hold it. */}
      <div className="hidden max-h-[560px] overflow-auto xl:block">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="max-w-56">Hire</TableHead>
              <TableHead className="max-w-44">Status / Phase</TableHead>
              <TableHead className="max-w-40">Date hired</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No hires match these filters.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => {
              const isActive = activeRow === row;
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
                    className="max-w-40 truncate"
                    title={row.dateHired ?? ""}
                  >
                    {formatHiredDate(row.dateHired)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t border-border/50 px-4 py-2 text-xs text-muted-foreground">
        <span aria-live="polite">{`Showing ${rows.length} of ${total} hires`}</span>
      </div>
    </div>
  );
}
