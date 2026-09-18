"use client";

import { useCallback, useState } from "react";
import { AlertCircle, CheckCircle2, GraduationCap } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

import { TASK_STATUS_LABELS, taskStatusTone } from "../rosterData";
import type {
  WorkspacePhaseGroup,
  WorkspaceTaskItem,
} from "../workspaceTasks";

// TrainingTab.tsx — the per-hire workspace Training section, rewritten onto the
// training-templates system. The hire's TRAINING-phase `onboarding_task` rows
// already arrive in the workspace's computed `phaseGroups`, so this tab is a
// pure projection: it renders that group as a checklist and completes rows
// through the generic onboarding-task completion endpoint. It no longer touches
// the legacy quiz-assignment engine — that stays live for the employee portal.

const TRAINING_PHASE = "training";

/** A task no longer blocks completion once done or waived as `na`. */
function isSatisfied(item: WorkspaceTaskItem): boolean {
  return item.status === "done" || item.status === "na";
}

export function TrainingTab({
  groups,
  loading,
  error,
  onRefresh,
}: {
  groups: WorkspacePhaseGroup[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const group = groups.find((entry) => entry.phase === TRAINING_PHASE) ?? null;
  const items = group?.items ?? [];

  const markDone = useCallback(
    async (taskId: number) => {
      setCheckingId(taskId);
      setActionError(null);
      try {
        const res = await fetch(
          `/api/hrm/onboarding/onboarding-task/${taskId}/complete`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );
        const body = (await res.json().catch(() => null)) as {
          success?: boolean;
          message?: string;
        } | null;
        if (!res.ok || !body?.success) {
          throw new Error(
            body?.message || "Could not mark this training item done."
          );
        }
        // Pessimistic: no optimistic flip — the refreshed task set is the
        // only source of the new status.
        onRefresh();
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Could not mark this item done."
        );
      } finally {
        setCheckingId(null);
      }
    },
    [onRefresh]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Training checklist</h2>
        <div className="grid gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <GraduationCap
          className="h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        Training checklist
      </h2>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Could not load training</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Could not mark this item done</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {error ? null : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No training assigned for this hire.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {group?.done}/{group?.total} training items completed
          </p>

          <Card className="shadow-none border-border overflow-hidden">
            <CardHeader>
              <CardTitle className="truncate" title="Training items">
                Training items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const satisfied = isSatisfied(item);
                  const busy = checkingId === item.taskId;
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
                          {item.required ? (
                            <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-xs font-medium text-foreground">
                              Required
                            </span>
                          ) : null}
                        </div>
                        {item.notes ? (
                          <p className="mt-1 text-xs text-muted-foreground break-words">
                            {item.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge tone={taskStatusTone(item.status)}>
                          {TASK_STATUS_LABELS[item.status]}
                        </StatusBadge>
                        {satisfied ? null : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void markDone(item.taskId)}
                            aria-label={`Mark ${item.label} as done`}
                          >
                            <CheckCircle2
                              className="mr-2 h-4 w-4"
                              aria-hidden="true"
                            />
                            {busy ? "Saving…" : "Mark done"}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
