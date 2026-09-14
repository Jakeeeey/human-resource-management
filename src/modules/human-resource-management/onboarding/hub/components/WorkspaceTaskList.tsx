"use client";

import { useState } from "react";
import { AlertCircle, ChevronDown, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

import {
  formatDueDate,
  isDateOverdue,
  TASK_STATUS_LABELS,
  taskStatusTone,
} from "../rosterData";
import type { WorkspacePhaseGroup } from "../workspaceTasks";

// WorkspaceTaskList.tsx — the phased task list inside the per-hire workspace
// (todo 28; enriched todo 29): one collapsible card per phase, each task
// showing its status, due date, whether it is the current NEXT ACTION, and —
// when blocked — the blocker reason. Every phase starts CLOSED and the rows
// inside an expanded phase are paginated. Rendering only; grouping lives in
// the pure `workspaceTasks.ts` and the next-action id is the same
// server-derived task the roster row already surfaces.

/** Rows shown per expanded phase page. */
const PAGE_SIZE = 5;

function TaskRow({
  item,
  nextTaskId,
}: {
  item: WorkspacePhaseGroup["items"][number];
  nextTaskId?: number | null;
}) {
  const overdue = isDateOverdue(item.dueDate);
  const isNext = item.taskId === nextTaskId;
  const isBlocked = item.status === "blocked";

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium" title={item.label}>
            {item.label}
          </p>
          {isNext && !item.satisfied ? (
            <StatusBadge tone="info">Next action</StatusBadge>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {item.dueDate ? (
            <span
              className={
                overdue && !item.satisfied
                  ? "font-medium text-destructive"
                  : undefined
              }
            >
              due {formatDueDate(item.dueDate)}
            </span>
          ) : null}
          {overdue && !item.satisfied ? (
            <span className="font-medium text-destructive">Overdue</span>
          ) : null}
          {item.required ? null : <span>optional</span>}
        </div>
        {isBlocked ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>
              Blocked
              {item.notes ? `: ${item.notes}` : ""}
            </span>
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge tone={taskStatusTone(item.status)}>
          {TASK_STATUS_LABELS[item.status]}
        </StatusBadge>
      </div>
    </li>
  );
}

// Paginates the rows of one expanded phase. Mounted inside the collapsible
// content, so collapsing unmounts it and re-opening starts back on page 1; the
// `key` on `itemCount` (set by the parent) resets the page when the phase's
// item count changes.
function PhaseItems({
  group,
  nextTaskId,
}: {
  group: WorkspacePhaseGroup;
  nextTaskId?: number | null;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(group.items.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleItems = group.items.slice(start, start + PAGE_SIZE);

  return (
    <>
      <ul className="divide-y divide-border">
        {visibleItems.map((item) => (
          <TaskRow key={item.taskId} item={item} nextTaskId={nextTaskId} />
        ))}
      </ul>
      {totalPages > 1 ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(Math.max(1, currentPage - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PhaseCard({
  group,
  nextTaskId,
}: {
  group: WorkspacePhaseGroup;
  nextTaskId?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const percent =
    group.total === 0 ? 0 : Math.round((group.done / group.total) * 100);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="shadow-none border-border overflow-hidden">
        <CollapsibleTrigger
          type="button"
          className="w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <ListChecks
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <CardTitle className="truncate" title={group.label}>
                  {group.label}
                </CardTitle>
              </div>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {group.done}/{group.total} done
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    open && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </span>
            </div>
            <Progress
              className="mt-2 h-1.5"
              value={percent}
              aria-label={`${group.label} progress`}
            />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <PhaseItems
              key={group.items.length}
              group={group}
              nextTaskId={nextTaskId}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function WorkspaceTaskList({
  groups,
  nextTaskId,
}: {
  groups: WorkspacePhaseGroup[];
  nextTaskId?: number | null;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No onboarding tasks are materialized for this hire yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <PhaseCard key={group.phase} group={group} nextTaskId={nextTaskId} />
      ))}
    </div>
  );
}
