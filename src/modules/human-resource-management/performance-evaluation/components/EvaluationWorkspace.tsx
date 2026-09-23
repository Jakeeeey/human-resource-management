"use client";

import Link from "next/link";
import { ClipboardCheck, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

import { useEvaluationWorkspace } from "../hooks/useEvaluationWorkspace";
import type { EvaluationScope } from "../providers/evaluationClient";
import type { WorkspaceBundle } from "../types/performance-evaluation.schema";
import { computeDueDates } from "../utils/probationClock";
import {
    deriveNextAction,
    deriveProbationStatus,
    deriveStage,
    type NextAction,
    type WorkflowStage,
} from "../utils/workflow";
import { HistoryPanel } from "./HistoryPanel";
import { KpiSheetForm } from "./KpiSheetForm";
import { NextActionCard } from "./NextActionCard";
import {
    buildWorkflowFacts,
    probationStatusLabel,
    probationStatusTone,
    workflowStageLabel,
    WorkspaceHero,
} from "./OverviewSection";
import { PipForm } from "./PipForm";
import { RecommendationSection } from "./RecommendationSection";
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

function stageHeading(stage: WorkflowStage): string {
    if (stage === "closed") return "Closing summary";
    return workflowStageLabel(stage);
}

function ClosingSummary({ bundle }: { bundle: WorkspaceBundle }) {
    const tracking = bundle.tracking;
    const regular = tracking?.regularized_at !== null && tracking?.regularized_at !== undefined;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Closing summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={regular ? "success" : "destructive"}>
                        {regular ? "Regular" : "Separated"}
                    </StatusBadge>
                    <span className="text-sm text-muted-foreground tabular-nums">
                        {regular ? tracking?.regularized_at : tracking?.terminated_at}
                    </span>
                </div>
                {!regular && tracking?.separation_type ? (
                    <p className="text-sm text-muted-foreground">{tracking.separation_type}</p>
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
    const { bundle, loading, error, refresh } = useEvaluationWorkspace(scope, userId);

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

                    <NextActionCard action={action} scope={scope} status={status} dueDate={dueDate} />

                    <section aria-label={stageHeading(stage)} className="space-y-4">
                        <h2 className="text-base font-semibold">{stageHeading(stage)}</h2>
                        {stage === "first_evaluation" ? (
                            <KpiSheetForm
                                scope={scope}
                                userId={userId}
                                evalType="first"
                                bundle={bundle}
                                onSaved={refresh}
                            />
                        ) : stage === "second_evaluation" ? (
                            <KpiSheetForm
                                scope={scope}
                                userId={userId}
                                evalType="second"
                                bundle={bundle}
                                onSaved={refresh}
                            />
                        ) : stage === "pip_1" || stage === "pip_2" ? (
                            <PipForm userId={userId} bundle={bundle} onSaved={refresh} />
                        ) : stage === "recommendation" || stage === "regularization" ? (
                            <RecommendationSection
                                scope={scope}
                                userId={userId}
                                bundle={bundle}
                                onRefresh={() => {
                                    void refresh();
                                }}
                            />
                        ) : (
                            <ClosingSummary bundle={bundle} />
                        )}
                    </section>

                    <HistoryPanel bundle={bundle} />
                </div>
            )}
        </div>
    );
}
