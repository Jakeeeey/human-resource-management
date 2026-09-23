"use client";

import Link from "next/link";

import { ArrowUpRight, CalendarDays, Clock, ListChecks, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

import type { RosterRow } from "../types/performance-evaluation.schema";
import {
  deadlineToneFor,
  formatRosterDate,
  type DueKey,
} from "./EvaluationRosterTable";
import { statusToneBadgeClass } from "./StatusPill";

const STAGE_LABELS: Record<string, string> = {
  first_evaluation: "1st evaluation",
  pip_1: "PIP #1",
  second_evaluation: "2nd evaluation",
  pip_2: "PIP #2",
  recommendation: "Recommendation",
  regularization: "Regularization",
  closed: "Closed",
};

const DUE_ROWS: readonly { key: DueKey; label: string }[] = [
  { key: "third", label: "3rd-month due" },
  { key: "fifth", label: "5th-month due" },
  { key: "sixth", label: "6th-month due" },
];

function deadlineValue(row: RosterRow, key: DueKey): string | null {
  if (key === "third") return row.third_month_due;
  if (key === "fifth") return row.fifth_month_due;
  return row.sixth_month_due;
}

function parseNextAction(
  value: RosterRow["next_action"]
): { label: string; owner: string } | null {
  if (!value || typeof value !== "object") return null;
  const label = value["label"];
  if (typeof label !== "string" || label.trim() === "") return null;
  const owner = value["owner"];
  return {
    label,
    owner: typeof owner === "string" && owner.trim() !== "" ? owner : "—",
  };
}

function ownerLabel(owner: string): string {
  if (owner === "hr") return "HR";
  if (owner === "head") return "Department head";
  return owner;
}

export function EvaluationRosterDetail({
  row,
  workspaceHref,
}: {
  row: RosterRow;
  workspaceHref?: string;
}) {
  const nextAction = parseNextAction(row.next_action);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section
        aria-label="Deadlines"
        className="rounded-[var(--radius)] border border-border/50 bg-card p-4"
      >
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          Deadlines
        </h4>
        <ul className="mt-2 divide-y divide-border/50">
          {DUE_ROWS.map(({ key, label }) => {
            const tone = deadlineToneFor(row, key);
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-2 py-2"
              >
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="flex items-center gap-2">
                  {tone === "overdue" ? (
                    <StatusBadge
                      tone="destructive"
                      className={statusToneBadgeClass("destructive")}
                    >
                      <TriangleAlert aria-hidden="true" />
                      Overdue
                    </StatusBadge>
                  ) : null}
                  {tone === "soon" ? (
                    <StatusBadge
                      tone="warning"
                      className={statusToneBadgeClass("warning")}
                    >
                      <Clock aria-hidden="true" />
                      Due soon
                    </StatusBadge>
                  ) : null}
                  <span
                    className={
                      tone === "overdue"
                        ? "text-sm font-semibold tabular-nums text-destructive"
                        : tone === "soon"
                          ? "text-sm font-medium tabular-nums text-[hsl(var(--warning))]"
                          : "text-sm tabular-nums text-muted-foreground"
                    }
                  >
                    {formatRosterDate(deadlineValue(row, key))}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-label="Progression"
        className="rounded-[var(--radius)] border border-border/50 bg-card p-4"
      >
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          Progression
        </h4>
        <dl className="mt-2 divide-y divide-border/50">
          <div className="flex items-center justify-between gap-2 py-2">
            <dt className="text-sm text-muted-foreground">Stage</dt>
            <dd className="text-sm font-semibold">
              {STAGE_LABELS[row.stage] ?? row.stage}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2 py-2">
            <dt className="text-sm text-muted-foreground">Next action</dt>
            <dd className="text-right text-sm font-semibold">
              {nextAction ? (
                nextAction.label
              ) : (
                <span className="font-normal text-muted-foreground">
                  None — the workflow is closed.
                </span>
              )}
            </dd>
          </div>
          {nextAction ? (
            <div className="flex items-center justify-between gap-2 py-2">
              <dt className="text-sm text-muted-foreground">Owner</dt>
              <dd>
                <StatusBadge tone="neutral">
                  {ownerLabel(nextAction.owner)}
                </StatusBadge>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {workspaceHref ? (
        <Button asChild className="w-full">
          <Link href={workspaceHref} target="_blank" rel="noopener noreferrer">
            Open workspace
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
