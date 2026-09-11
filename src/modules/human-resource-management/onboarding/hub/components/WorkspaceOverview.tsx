"use client";

import { useState } from "react";
import { AlertCircle, ChevronDown, Inbox, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

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
// the inbox is a pure projection of that same set. The inbox + summary share
// the aside so the task list is never stacked below a duplicated copy of
// itself (S7#8).

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
  const [inboxOpen, setInboxOpen] = useState(false);

  return (
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

      <aside className="min-w-0 space-y-6">
        {error ? null : loading ? null : (
          <>
            {/* Below lg: a compact count with an expander, so the 22-item list
                is not followed by a full second copy of the same tasks. */}
            <div className="space-y-3 lg:hidden">
              <button
                type="button"
                aria-expanded={inboxOpen}
                onClick={() => setInboxOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Inbox
                    className="h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="truncate font-semibold">My tasks</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusBadge
                    tone={needsAttention.length > 0 ? "warning" : "success"}
                  >
                    {needsAttention.length > 0
                      ? `${needsAttention.length} need attention`
                      : "All clear"}
                  </StatusBadge>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      inboxOpen && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </span>
              </button>
              {inboxOpen ? (
                <WorkspaceNeedsAttention
                  items={needsAttention}
                  operator={operator}
                />
              ) : null}
            </div>

            {/* lg+: the two-column side-by-side inbox stays a full card. */}
            <div className="hidden lg:block">
              <WorkspaceNeedsAttention
                items={needsAttention}
                operator={operator}
              />
            </div>
          </>
        )}

        <div>
          <h2 className="mb-3 text-lg font-semibold">Summary</h2>
          {row ? (
            <HireRosterDetail row={row} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No summary is available for this hire.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
