"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { RosterRow } from "../types/performance-evaluation.schema";
import { attentionFor, formatRosterDate } from "./EvaluationRosterTable";
import { EvaluationRosterDetail } from "./EvaluationRosterDetail";
import { StatusPill } from "./StatusPill";
import { StatusBadge } from "@/components/ui/status-badge";

export function EvaluationRosterPanel({
  open,
  onOpenChange,
  row,
  workspaceHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: RosterRow | null;
  workspaceHref?: string;
}) {
  if (row === null) {
    return null;
  }

  const meta = [row.department_name, row.position]
    .filter(
      (part): part is string => typeof part === "string" && part.trim() !== ""
    )
    .join(" · ");
  const attention = attentionFor(row);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full min-w-0 flex-col gap-0 p-0 sm:max-w-md"
        aria-label={`Evaluation summary for ${row.full_name}`}
      >
        <SheetHeader className="border-b border-border/50 p-4 pr-12 text-left">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill status={row.probation_status} />
            {attention === "overdue" ? (
              <StatusBadge tone="destructive">Overdue</StatusBadge>
            ) : null}
            {attention === "soon" ? (
              <StatusBadge tone="warning">Due soon</StatusBadge>
            ) : null}
          </div>
          <SheetTitle className="mt-2 truncate text-lg" title={row.full_name}>
            {row.full_name}
          </SheetTitle>
          <SheetDescription className="truncate">
            {meta === "" ? "—" : meta} · Hired{" "}
            {formatRosterDate(row.date_hired)}
          </SheetDescription>
        </SheetHeader>

        <div className="min-w-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4">
          <EvaluationRosterDetail row={row} workspaceHref={workspaceHref} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
