"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CircleUserRound,
  ListChecks,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
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

// HireRosterDetail.tsx — the master-detail right pane (todo 27). Read-only:
// it renders one enriched roster row (progress, next action, owner, due,
// blockers, per-phase progress). Shared by the inline lg+ pane and the
// below-lg dialog so both surfaces show identical information.

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-2 truncate text-sm font-semibold",
          tone === "danger" ? "text-destructive" : "text-foreground"
        )}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1 truncate text-xs text-muted-foreground" title={hint}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Renders the selected hire's enriched onboarding summary.
 * @param row - One roster row built by the hire-roster service.
 * @param workspaceHref - When given, renders the canonical "one selected hire"
 * navigation into the per-hire workspace. Omitted inside the workspace itself
 * (already there) so the summary stays a pure read-only pane.
 */
export function HireRosterDetail({
  row,
  workspaceHref,
}: {
  row: HireRosterRow;
  workspaceHref?: string;
}) {
  const percent =
    row.requiredTotal === 0
      ? 0
      : Math.round((row.requiredDone / row.requiredTotal) * 100);
  const dueOverdue = isDateOverdue(row.dueDate);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-border/50 bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold" title={row.name}>
            {row.name}
          </h3>
          <p className="text-xs text-muted-foreground">Employee #{row.userId}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge tone={rosterStatusTone(row.status)}>
            {ROSTER_STATUS_LABELS[row.status]}
          </StatusBadge>
          {workspaceHref ? (
            <Button asChild size="sm" variant="outline">
              <Link href={workspaceHref}>Open workspace</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Required tasks</span>
          <span className="text-muted-foreground">
            {row.requiredDone} / {row.requiredTotal} done
          </span>
        </div>
        <Progress
          className="mt-3"
          value={percent}
          aria-label={`${row.requiredDone} of ${row.requiredTotal} required tasks complete`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
          label="Phase"
          value={phaseLabel(row.phase)}
        />
        <StatCard
          icon={<CircleUserRound className="h-4 w-4" aria-hidden="true" />}
          label="Owner"
          value={
            row.ownerRole ? OWNER_ROLE_LABELS[row.ownerRole] : "—"
          }
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
          label="Next action"
          value={
            row.nextAction
              ? row.nextAction.blocked
                ? `${row.nextAction.label} (blocked)`
                : row.nextAction.label
              : "All required tasks done"
          }
        />
        <StatCard
          icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
          label="Due"
          value={formatDueDate(row.dueDate)}
          hint={dueOverdue ? "Overdue" : undefined}
          tone={dueOverdue ? "danger" : "default"}
        />
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Phase progress
        </div>
        <div className="mt-3 grid gap-3">
          {row.phaseProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No required tasks recorded.
            </p>
          ) : (
            row.phaseProgress.map((phase) => {
              const phasePercent =
                phase.total === 0
                  ? 0
                  : Math.round((phase.done / phase.total) * 100);
              return (
                <div key={phase.phase} className="grid gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{phaseLabel(phase.phase)}</span>
                    <span className="text-muted-foreground">
                      {phase.done} / {phase.total}
                    </span>
                  </div>
                  <Progress
                    className="h-1.5"
                    value={phasePercent}
                    aria-label={`${phaseLabel(phase.phase)} progress`}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Blockers
        </div>
        {row.blockers.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No blockers.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {row.blockers.map((blocker) => (
              <li
                key={blocker.taskId}
                className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5"
              >
                <div className="truncate text-sm font-medium" title={blocker.label}>
                  {blocker.label}
                </div>
                {blocker.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {blocker.notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
