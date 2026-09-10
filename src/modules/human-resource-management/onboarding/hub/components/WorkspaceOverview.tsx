"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { HireRosterRow } from "../types/hire-roster.schema";
import { buildNeedsAttention, type WorkspaceOperator } from "../taskInbox";
import type { WorkspacePhaseGroup } from "../workspaceTasks";
import { HireRosterDetail } from "./HireRosterDetail";
import { WorkspaceNeedsAttention } from "./WorkspaceNeedsAttention";
import { WorkspaceTaskList } from "./WorkspaceTaskList";

// WorkspaceOverview.tsx — the Overview section of the per-hire workspace
// (todo 28; inbox added todo 29): the same enriched summary the roster detail
// shows, the role-scoped "My tasks / needs attention" inbox, and the phased
// task list. It owns no data — the workspace hook feeds it ONE task set, and
// the inbox is a pure projection of that same set.

export function WorkspaceOverview({
  row,
  groups,
  operator,
  loading,
  error,
  onRefresh,
}: {
  row: HireRosterRow | null;
  groups: WorkspacePhaseGroup[];
  operator: WorkspaceOperator;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const needsAttention = buildNeedsAttention(groups, operator);

  return (
    <div className="grid gap-6">
      {error ? null : loading ? null : (
        <WorkspaceNeedsAttention
          items={needsAttention}
          operator={operator}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,10fr)_minmax(0,9fr)]">
        <section className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Phased task list</h2>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Could not load this hire</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : loading ? (
            <div className="grid gap-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <WorkspaceTaskList
              groups={groups}
              nextTaskId={row?.nextAction?.taskId ?? null}
            />
          )}
        </section>

        <aside className="min-w-0">
          <h2 className="mb-3 text-lg font-semibold">Summary</h2>
          {row ? (
            <HireRosterDetail row={row} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No summary is available for this hire.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
