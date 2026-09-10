"use client";

import { AlertCircle, Inbox } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

import {
  formatDueDate,
  isDateOverdue,
  OWNER_ROLE_LABELS,
  phaseLabel,
  TASK_STATUS_LABELS,
  taskStatusTone,
} from "../rosterData";
import type { WorkspaceOperator } from "../taskInbox";
import type { WorkspaceTaskItem } from "../workspaceTasks";

// WorkspaceNeedsAttention.tsx — the role-scoped "My tasks / needs attention"
// inbox (todo 29). It renders a projection of the SAME task set the phased list
// shows (passed in as `items`), already filtered by the pure
// `buildNeedsAttention` helper to the operator's own open tasks. It owns no
// fetch and no task state, and it never offers a role switch: the operator is
// the server-resolved session identity.

export function WorkspaceNeedsAttention({
  items,
  operator,
}: {
  items: WorkspaceTaskItem[];
  operator: WorkspaceOperator;
}) {
  const roleLabel = OWNER_ROLE_LABELS[operator.role];

  return (
    <Card className="shadow-none border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Inbox className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <CardTitle className="truncate">My tasks</CardTitle>
          </div>
          <StatusBadge tone={items.length > 0 ? "warning" : "success"}>
            {items.length > 0 ? `${items.length} need attention` : "All clear"}
          </StatusBadge>
        </div>
        <p className="text-sm text-muted-foreground">
          Needs attention · owned by {roleLabel}
          {operator.userId !== null ? ` (user #${operator.userId})` : ""}
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {roleLabel}-owned tasks need your attention right now. Other
            owners remain visible in the full phased task list.
          </p>
        ) : (
          <ul className="grid gap-2">
            {items.map((item) => {
              const overdue = isDateOverdue(item.dueDate);
              const isBlocked = item.status === "blocked";
              return (
                <li
                  key={item.taskId}
                  className={cn(
                    "rounded-xl border bg-card p-3",
                    isBlocked ? "border-destructive/40" : "border-border/60"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <p
                        className="truncate text-sm font-medium"
                        title={item.label}
                      >
                        {item.label}
                      </p>
                      <StatusBadge tone={taskStatusTone(item.status)}>
                        {TASK_STATUS_LABELS[item.status]}
                      </StatusBadge>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {phaseLabel(item.phase)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 font-medium text-foreground">
                      Owner: {OWNER_ROLE_LABELS[item.ownerRole]}
                    </span>
                    <span
                      className={
                        overdue ? "font-medium text-destructive" : undefined
                      }
                    >
                      {item.dueDate
                        ? `due ${formatDueDate(item.dueDate)}`
                        : "no due date"}
                    </span>
                    {overdue ? (
                      <span className="font-medium text-destructive">
                        Overdue
                      </span>
                    ) : null}
                  </div>
                  {isBlocked ? (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
                      <AlertCircle
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        Blocked{item.notes ? `: ${item.notes}` : ""}
                      </span>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
