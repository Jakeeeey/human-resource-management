"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

import type { EvaluationScope } from "../providers/evaluationClient";
import type { NextAction, ProbationStatus } from "../utils/workflow";
import { isDateOverdue } from "../utils/probationClock";
import { isDueSoon, probationStatusLabel, probationStatusTone } from "./OverviewSection";

const OWNER_LABELS = {
    hr: "HR",
    head: "Department head",
    employee: "Employee",
} as const;

const AWAITING_LABELS = {
    hr: "Awaiting HR",
    head: "Awaiting the department head",
    employee: "Awaiting the employee",
} as const;

export function NextActionCard({
    action,
    scope,
    status,
    dueDate,
}: {
    action: NextAction | null;
    scope: EvaluationScope;
    status: ProbationStatus;
    dueDate: string | null;
}) {
    const overdue = dueDate !== null && isDateOverdue(dueDate);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Next action</CardTitle>
            </CardHeader>
            <CardContent>
                {action ? (
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{action.label}</span>
                            <Badge variant="outline">{OWNER_LABELS[action.owner]}</Badge>
                            {dueDate ? (
                                <DueBadge due={dueDate} overdue={overdue} />
                            ) : null}
                        </div>
                        {action.owner !== scope ? (
                            <p className="text-sm font-medium text-foreground">
                                {AWAITING_LABELS[action.owner]}{" "}
                                <span className="font-normal text-muted-foreground">
                                    — nothing is required from you on this step.
                                </span>
                            </p>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                {dueDate
                                    ? `Due ${dueDate}. Complete this step to move the workflow forward.`
                                    : "Complete this step to move the workflow forward."}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={probationStatusTone(status)}>
                            {probationStatusLabel(status)}
                        </StatusBadge>
                        <span className="text-sm text-muted-foreground">
                            No further action — this workflow is closed.
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function DueBadge({ due, overdue }: { due: string; overdue: boolean }) {
    if (overdue) {
        return (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="tabular-nums">{due}</span>
                <StatusBadge tone="destructive">Overdue</StatusBadge>
            </span>
        );
    }
    if (isDueSoon(due)) {
        return (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="tabular-nums">{due}</span>
                <StatusBadge tone="warning">Due soon</StatusBadge>
            </span>
        );
    }
    return <span className="text-sm text-muted-foreground tabular-nums">{due}</span>;
}
