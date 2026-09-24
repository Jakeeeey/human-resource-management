"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    ctaHref,
    ctaLabel,
    showCta = false,
}: {
    action: NextAction | null;
    scope: EvaluationScope;
    status: ProbationStatus;
    dueDate: string | null;
    ctaHref?: string;
    ctaLabel?: string | null;
    showCta?: boolean;
}) {
    const overdue = dueDate !== null && isDateOverdue(dueDate);
    const showStageCta =
        showCta && ctaHref !== undefined && ctaLabel != null;

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
                            showStageCta ? (
                                <p className="text-sm font-medium text-foreground">
                                    {AWAITING_LABELS[action.owner]}{" "}
                                    <span className="font-normal text-muted-foreground">
                                        — you can still revise the plan until it is acknowledged.
                                    </span>
                                </p>
                            ) : (
                                <p className="text-sm font-medium text-foreground">
                                    {AWAITING_LABELS[action.owner]}{" "}
                                    <span className="font-normal text-muted-foreground">
                                        — nothing is required from you on this step.
                                    </span>
                                </p>
                            )
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                {dueDate
                                    ? `Due ${dueDate}. Complete this step to move the workflow forward.`
                                    : "Complete this step to move the workflow forward."}
                            </p>
                        )}
                        {showStageCta ? (
                            <div className="pt-1">
                                <Button
                                    asChild
                                    size="sm"
                                    className="min-h-11 w-full sm:w-auto md:min-h-0"
                                >
                                    <Link href={ctaHref ?? ""}>
                                        {ctaLabel}
                                        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                                    </Link>
                                </Button>
                            </div>
                        ) : null}
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
