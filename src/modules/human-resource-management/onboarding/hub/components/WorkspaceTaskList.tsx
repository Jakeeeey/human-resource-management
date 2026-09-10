"use client";

import { AlertCircle, ListChecks } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";

import {
  formatDueDate,
  isDateOverdue,
  OWNER_ROLE_LABELS,
  TASK_STATUS_LABELS,
  taskStatusTone,
} from "../rosterData";
import type { WorkspacePhaseGroup } from "../workspaceTasks";

// WorkspaceTaskList.tsx — the phased, owner-attributed task list inside the
// per-hire workspace (todo 28; enriched todo 29): one card per phase, each
// task showing its owner, status, due date, whether it is the current NEXT
// ACTION, and — when blocked — the blocker reason. Rendering only; grouping
// lives in the pure `workspaceTasks.ts` and the next-action id is the same
// server-derived task the roster row already surfaces.

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
      {groups.map((group) => {
        const percent =
          group.total === 0
            ? 0
            : Math.round((group.done / group.total) * 100);
        return (
          <Card
            key={group.phase}
            className="shadow-none border-border overflow-hidden"
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
                <span className="shrink-0 text-xs text-muted-foreground">
                  {group.done}/{group.total} done
                </span>
              </div>
              <Progress
                className="mt-2 h-1.5"
                value={percent}
                aria-label={`${group.label} progress`}
              />
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {group.items.map((item) => {
                  const overdue = isDateOverdue(item.dueDate);
                  const isNext = item.taskId === nextTaskId;
                  const isBlocked = item.status === "blocked";
                  return (
                    <li
                      key={item.taskId}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p
                            className="truncate text-sm font-medium"
                            title={item.label}
                          >
                            {item.label}
                          </p>
                          {isNext && !item.satisfied ? (
                            <StatusBadge tone="info">Next action</StatusBadge>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 font-medium text-foreground">
                            Owner: {OWNER_ROLE_LABELS[item.ownerRole]}
                          </span>
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
                            <span className="font-medium text-destructive">
                              Overdue
                            </span>
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
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
