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

import { TASK_STATUS_LABELS, taskStatusTone } from "../rosterData";
import type { WorkspacePhaseGroup } from "../workspaceTasks";

// WorkspaceTaskList.tsx — the phased task list inside the per-hire workspace
// (todo 28; enriched todo 29): one collapsible card per phase, each task
// showing its status and — when blocked — the blocker reason. Every phase
// starts CLOSED and the rows inside an expanded phase are paginated.
// Rendering only; grouping lives in the pure `workspaceTasks.ts`.

/** Rows shown per expanded phase page. */
const PAGE_SIZE = 5;

function TaskRow({ item }: { item: WorkspacePhaseGroup["items"][number] }) {
  const isBlocked = item.status === "blocked";

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={item.label}>
          {item.label}
        </p>
        {item.required ? null : (
          <p className="mt-1 text-xs text-muted-foreground">optional</p>
        )}
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
function PhaseItems({ group }: { group: WorkspacePhaseGroup }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(group.items.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleItems = group.items.slice(start, start + PAGE_SIZE);

  return (
    <>
      <ul className="divide-y divide-border">
        {visibleItems.map((item) => (
          <TaskRow key={item.taskId} item={item} />
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

function PhaseCard({ group }: { group: WorkspacePhaseGroup }) {
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
                {group.done}/{group.total} tasks done
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
            <PhaseItems key={group.items.length} group={group} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function WorkspaceTaskList({
  groups,
}: {
  groups: WorkspacePhaseGroup[];
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
        <PhaseCard key={group.phase} group={group} />
      ))}
    </div>
  );
}
