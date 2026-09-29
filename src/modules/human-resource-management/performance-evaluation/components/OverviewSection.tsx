"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";

import type {
    EmployeeProfile,
    WorkspaceBundle,
} from "../types/performance-evaluation.schema";
import {
    deriveProbationStatus,
    deriveStage,
    type ProbationStatus,
    type WorkflowFacts,
    type WorkflowStage,
} from "../utils/workflow";
import {
    computeDueDates,
    formatHiredDate,
    isDateOverdue,
    parseLocalDate,
} from "../utils/probationClock";
import {
    PROBATION_STATUS_LABELS,
    PROBATION_STATUS_TONES,
} from "./StatusPill";

export function buildWorkflowFacts(bundle: WorkspaceBundle): WorkflowFacts {
    const evalTypeById = new Map(bundle.evaluations.map((entry) => [entry.id, entry.eval_type]));
    return {
        dateHired: bundle.employee.date_hired ?? null,
        regularizedAt: bundle.tracking?.regularized_at ?? null,
        terminatedAt: bundle.tracking?.terminated_at ?? null,
        recommendationIssuedAt: bundle.tracking?.recommendation_issued_at ?? null,
        evaluations: bundle.evaluations.map((entry) => ({
            evalType: entry.eval_type,
            result: entry.result,
            voidedAt: entry.voided_at,
        })),
        pips: bundle.pips.map((pip) => ({
            evaluationId: pip.evaluation_id,
            evalType: evalTypeById.get(pip.evaluation_id) ?? "first",
            status: pip.status,
            acknowledgedAt: pip.employee_acknowledged_at,
        })),
    };
}

const STAGE_LABELS: Record<WorkflowStage, string> = {
    first_evaluation: "1st evaluation",
    pip_1: "PIP",
    second_evaluation: "2nd evaluation",
    third_evaluation: "3rd evaluation",
    recommendation: "Recommendation",
    regularization: "Regularization",
    termination_review: "Termination review",
    closed: "Closed",
};

export function probationStatusLabel(status: ProbationStatus): string {
    return PROBATION_STATUS_LABELS[status] ?? status;
}

export function probationStatusTone(
    status: ProbationStatus,
): "neutral" | "success" | "warning" | "info" | "destructive" {
    return PROBATION_STATUS_TONES[status] ?? "neutral";
}

export function workflowStageLabel(stage: WorkflowStage): string {
    return STAGE_LABELS[stage];
}

export function isDueSoon(value: string | null | undefined, now: Date = new Date()): boolean {
    const target = parseLocalDate(value);
    if (target === null) return false;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
    return diffDays >= 0 && diffDays <= 30;
}

function dueBadgeFor(due: string, relevant: boolean) {
    if (!relevant) return null;
    if (isDateOverdue(due)) return <StatusBadge tone="destructive">Overdue</StatusBadge>;
    if (isDueSoon(due)) return <StatusBadge tone="warning">Due soon</StatusBadge>;
    return null;
}

type DueKey = "day30" | "day60" | "day90" | "sixth";

function pipDueKey(facts: WorkflowFacts): DueKey {
    const openPip = facts.pips.find((pip) => pip.status === "open") ?? facts.pips[0] ?? null;
    if (openPip?.evalType === "second") return "day60";
    if (openPip?.evalType === "third") return "day90";
    if (openPip !== null) return "day30";
    const failed = facts.evaluations.find(
        (entry) => entry.voidedAt === null && entry.result === "failed",
    );
    if (failed?.evalType === "second") return "day60";
    if (failed?.evalType === "third") return "day90";
    return "day30";
}

function DueRow({
    label,
    due,
    dueKey,
    relevantKey,
}: {
    label: string;
    due: string;
    dueKey: DueKey;
    relevantKey: DueKey | null;
}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="flex items-center gap-2 font-medium tabular-nums">
                {due}
                {dueBadgeFor(due, dueKey === relevantKey)}
            </dd>
        </div>
    );
}

export function WorkspaceHero({
    employee,
    userId,
    bundle,
}: {
    employee: EmployeeProfile | null;
    userId: number;
    bundle: WorkspaceBundle;
}) {
    const facts = buildWorkflowFacts(bundle);
    const status = deriveProbationStatus(facts);
    const stage = deriveStage(facts);
    const dueDates = computeDueDates(facts.dateHired);
    const relevantKey =
        stage === "first_evaluation"
            ? ("day30" as DueKey)
            : stage === "pip_1"
              ? pipDueKey(facts)
              : stage === "second_evaluation"
                ? ("day60" as DueKey)
                : stage === "third_evaluation"
                  ? ("day90" as DueKey)
                  : stage === "recommendation" || stage === "regularization"
                    ? ("sixth" as DueKey)
                    : null;
    const identity = [employee?.department_name, employee?.position].filter(
        (part): part is string => part !== null && part !== undefined && part !== "",
    );

    return (
        <Card>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Employee {userId} · Hired {formatHiredDate(facts.dateHired)}
                    </p>
                    <h2 className="text-xl font-semibold sm:text-2xl">
                        {employee?.full_name ?? `Employee #${userId}`}
                    </h2>
                    {identity.length > 0 ? (
                        <p className="text-sm text-muted-foreground">{identity.join(" · ")}</p>
                    ) : null}
                    {dueDates ? (
                        <dl className="space-y-1 pt-2 text-sm">
                            <DueRow label="30-day due" due={dueDates.day30} dueKey="day30" relevantKey={relevantKey} />
                            <DueRow label="60-day due" due={dueDates.day60} dueKey="day60" relevantKey={relevantKey} />
                            <DueRow label="90-day due" due={dueDates.day90} dueKey="day90" relevantKey={relevantKey} />
                            <DueRow label="6th-month due" due={dueDates.sixth} dueKey="sixth" relevantKey={relevantKey} />
                        </dl>
                    ) : (
                        <p className="pt-2 text-sm text-muted-foreground">
                            No hire date on record, so no due dates can be computed yet.
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-col md:items-end">
                    <StatusBadge tone={probationStatusTone(status)}>
                        {probationStatusLabel(status)}
                    </StatusBadge>
                    <StatusBadge tone={stage === "closed" ? "neutral" : "info"}>
                        {workflowStageLabel(stage)}
                    </StatusBadge>
                </div>
            </CardContent>
        </Card>
    );
}
