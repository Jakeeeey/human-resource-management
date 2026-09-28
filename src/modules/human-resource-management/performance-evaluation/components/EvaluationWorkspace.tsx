"use client";

import Link from "next/link";
import { ClipboardCheck, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

import { useEvaluationWorkspace } from "../hooks/useEvaluationWorkspace";
import type { EvaluationScope } from "../providers/evaluationClient";
import type { WorkspaceBundle } from "../types/performance-evaluation.schema";
import { computeDueDates, formatHiredDate } from "../utils/probationClock";
import {
    deriveNextAction,
    deriveProbationStatus,
    deriveStage,
    type NextAction,
} from "../utils/workflow";
import { derivePipPhase } from "../utils/pipGuards";
import { HistoryPanel } from "./HistoryPanel";
import { NextActionCard } from "./NextActionCard";
import {
    buildWorkflowFacts,
    probationStatusLabel,
    probationStatusTone,
    WorkspaceHero,
} from "./OverviewSection";
import { StageRail } from "./StageRail";

function dueKeyForAction(key: NextAction["key"]): "third" | "fifth" | "sixth" {
    if (key === "second_evaluation" || key === "create_pip_2" || key === "close_pip_2") {
        return "fifth";
    }
    if (key === "recommendation" || key === "regularize") {
        return "sixth";
    }
    return "third";
}

function stageHrefForAction(scope: EvaluationScope, userId: number): string {
    return scope === "hr"
        ? `/hrm/performance-evaluation/${userId}/stage`
        : `/hrm/department-evaluation/${userId}/stage`;
}

function stageCtaLabel(bundle: WorkspaceBundle): string | null {
    const facts = buildWorkflowFacts(bundle);
    const stage = deriveStage(facts);
    if (stage === "first_evaluation") return "Open 1st evaluation form";
    if (stage === "second_evaluation") return "Open 2nd evaluation form";
    if (stage === "pip_1" || stage === "pip_2") {
        const pipNumber = stage === "pip_1" ? "1" : "2";
        if (bundle.pips.length === 0) return `Create PIP #${pipNumber}`;
        const currentPip = [...bundle.pips].sort((a, b) => b.id - a.id)[0];
        const phase = derivePipPhase({
            status: currentPip.status,
            employeeAcknowledgedAt: currentPip.employee_acknowledged_at,
        });
        if (phase === "ready_for_review") return `Record PIP #${pipNumber} outcome`;
        return `Edit PIP #${pipNumber} plan`;
    }
    if (stage === "recommendation") return "Open recommendation form";
    if (stage === "regularization") return "Open regularization form";
    return null;
}

const SEPARATION_LABELS: Record<string, string> = {
    failed_probation: "Failed probation",
    resigned: "Resigned",
    laid_off: "Laid off",
};

function separationLabel(value: string): string {
    return SEPARATION_LABELS[value] ?? value.replace(/_/g, " ");
}

function formatClosingDate(value: string | null | undefined): string {
    if (!value) return "—";
    return formatHiredDate(value.slice(0, 10));
}

function ClosingSummary({ bundle }: { bundle: WorkspaceBundle }) {
    const tracking = bundle.tracking;
    const regular = tracking?.regularized_at !== null && tracking?.regularized_at !== undefined;
    const closingDate = regular
        ? formatClosingDate(tracking?.regularized_at)
        : formatClosingDate(tracking?.terminated_at);

    return (
        <Card>
            <CardContent className="space-y-2 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={regular ? "success" : "destructive"}>
                        {regular ? "Regular" : "Separated"}
                    </StatusBadge>
                    <span className="text-sm text-muted-foreground tabular-nums">
                        {closingDate}
                    </span>
                </div>
                {!regular && tracking?.separation_type ? (
                    <p className="text-sm text-muted-foreground">{separationLabel(tracking.separation_type)}</p>
                ) : null}
                {!regular && tracking?.termination_reason ? (
                    <p className="text-sm text-foreground">{tracking.termination_reason}</p>
                ) : null}
                {regular ? (
                    <p className="text-sm text-muted-foreground">
                        {probationStatusLabel("regular")} — no further action is required.
                    </p>
                ) : null}
            </CardContent>
        </Card>
    );
}

function WorkspaceSkeletons() {
    return (
        <div className="space-y-6" aria-label="Loading workspace">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

export function EvaluationWorkspace({
    scope,
    userId,
}: {
    scope: EvaluationScope;
    userId: number;
}) {
    const { bundle, loading, error, errorStatus, refresh } = useEvaluationWorkspace(scope, userId);

    const employee = bundle?.employee ?? null;
    const title = employee?.full_name ?? `Employee #${userId}`;
    const facts = bundle ? buildWorkflowFacts(bundle) : null;
    const status = facts ? deriveProbationStatus(facts) : null;
    const stage = facts ? deriveStage(facts) : null;
    const action = facts ? deriveNextAction(facts) : null;
    const dueDates = facts ? computeDueDates(facts.dateHired) : null;
    const dueDate = action && dueDates ? dueDates[dueKeyForAction(action.key)] : null;
    const rosterHref =
        scope === "hr"
            ? `/hrm/performance-evaluation?selected=${userId}`
            : `/hrm/department-evaluation?selected=${userId}`;
    const activeOwnedByOther = action !== null && action.owner !== scope;
    const latestPip =
        bundle !== null && bundle.pips.length > 0
            ? [...bundle.pips].sort((a, b) => b.id - a.id)[0]
            : null;
    const pipPlanEditable =
        latestPip != null &&
        latestPip.status === "open" &&
        latestPip.employee_acknowledged_at == null;
    const viewerCanAct =
        !activeOwnedByOther || (pipPlanEditable && scope === "head");
    const ctaLabel = bundle ? stageCtaLabel(bundle) : null;
    const showStageCta =
        bundle !== null &&
        stage !== null &&
        stage !== "closed" &&
        action !== null &&
        viewerCanAct &&
        ctaLabel !== null;

    const handleRefresh = () => {
        void refresh();
    };

    return (
        <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                    <div className="shrink-0 rounded-2xl bg-primary/10 p-3">
                        <ClipboardCheck className="h-6 w-6 text-primary" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1
                                className="line-clamp-2 text-2xl font-bold sm:text-4xl"
                                title={title}
                            >
                                {title}
                            </h1>
                            {status ? (
                                <StatusBadge tone={probationStatusTone(status)}>
                                    {probationStatusLabel(status)}
                                </StatusBadge>
                            ) : null}
                        </div>
                        <p className="text-base text-muted-foreground sm:text-lg">
                            Performance evaluation workspace
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 gap-2">
                    <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full sm:w-auto md:min-h-0"
                    >
                        <Link href={rosterHref}>Back to roster</Link>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full sm:w-auto md:min-h-0"
                        onClick={handleRefresh}
                        disabled={loading}
                        aria-label="Refresh workspace"
                        title="Refresh workspace"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                        Refresh
                    </Button>
                </div>
            </div>

            {loading && !bundle ? (
                <WorkspaceSkeletons />
            ) : errorStatus === 403 || errorStatus === 404 ? (
                <Alert>
                    <AlertTitle>Not available</AlertTitle>
                    <AlertDescription className="space-y-3">
                        <p>
                            {errorStatus === 403
                                ? "This employee is outside your scope, so their evaluation workspace is not available to you."
                                : "This employee could not be found."}
                        </p>
                        <Button asChild variant="outline" size="sm">
                            <Link href={rosterHref}>Back to roster</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : error || !bundle || !facts || !status || !stage ? (
                <Alert variant="destructive">
                    <AlertTitle>Workspace unavailable</AlertTitle>
                    <AlertDescription className="space-y-3">
                        <p>{error ?? "This workspace could not be loaded."}</p>
                        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="space-y-6">
                    <WorkspaceHero employee={employee} userId={userId} bundle={bundle} />

                    <StageRail facts={facts} stage={stage} />

                    <NextActionCard
                        action={action}
                        scope={scope}
                        status={status}
                        dueDate={dueDate}
                        ctaHref={stageHrefForAction(scope, userId)}
                        ctaLabel={ctaLabel}
                        showCta={showStageCta}
                    />

                    {stage === "closed" ? <ClosingSummary bundle={bundle} /> : null}

                    <HistoryPanel bundle={bundle} />
                </div>
            )}
        </div>
    );
}
