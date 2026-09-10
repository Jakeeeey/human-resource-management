"use client";

import { AlertCircle } from "lucide-react";

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
// — selection and filtering are owned by `HireRoster`.

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
      <div className="h-[560px] overflow-auto">
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
                        {phaseLabel(row.phase)}
                        {row.requiredTotal > 0
                          ? ` · ${row.requiredDone}/${row.requiredTotal}`
                          : ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell
                    className="max-w-64 truncate"
                    title={row.nextAction?.label ?? ""}
                  >
                    {row.nextAction
                      ? row.nextAction.blocked
                        ? `${row.nextAction.label} (blocked)`
                        : row.nextAction.label
                      : "All required tasks done"}
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
