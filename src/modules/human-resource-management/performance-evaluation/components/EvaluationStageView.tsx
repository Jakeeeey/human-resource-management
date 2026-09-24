"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

import { useEvaluationWorkspace } from "../hooks/useEvaluationWorkspace";
import type { EvaluationScope } from "../providers/evaluationClient";
import type { WorkspaceBundle } from "../types/performance-evaluation.schema";
import { deriveNextAction, deriveStage, type WorkflowStage } from "../utils/workflow";
import { KpiSheetForm } from "./KpiSheetForm";
import { buildWorkflowFacts, workflowStageLabel } from "./OverviewSection";
import { PipForm } from "./PipForm";
import { RecommendationSection } from "./RecommendationSection";

function stageScopePath(scope: EvaluationScope): string {
  return scope === "hr"
    ? "/hrm/performance-evaluation"
    : "/hrm/department-evaluation";
}

function ClosedStageCard({ bundle }: { bundle: WorkspaceBundle }) {
  const regular =
    bundle.tracking?.regularized_at !== null &&
    bundle.tracking?.regularized_at !== undefined;
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={regular ? "success" : "destructive"}>
            {regular ? "Regular" : "Separated"}
          </StatusBadge>
        </div>
        <p className="text-sm text-muted-foreground">
          {regular
            ? "This workflow is closed — no further action is required."
            : "This workflow is closed. The history on the workspace overview stays reviewable."}
        </p>
      </CardContent>
    </Card>
  );
}

function StageSkeletons() {
  return (
    <div className="space-y-4" aria-label="Loading stage form">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export function EvaluationStageView({
  scope,
  userId,
}: {
  scope: EvaluationScope;
  userId: number;
}) {
  const { bundle, loading, error, errorStatus, refresh } =
    useEvaluationWorkspace(scope, userId);
  const searchParams = useSearchParams();
  const selected = searchParams.get("selected");
  const workspaceHref =
    selected !== null && selected !== ""
      ? `${stageScopePath(scope)}/${userId}?selected=${encodeURIComponent(selected)}`
      : `${stageScopePath(scope)}/${userId}`;

  const facts = bundle ? buildWorkflowFacts(bundle) : null;
  const stage: WorkflowStage | null = facts ? deriveStage(facts) : null;
  const action = facts ? deriveNextAction(facts) : null;
  const actionOwnedByOther = action !== null && action.owner !== scope;

  const handleRefresh = () => {
    void refresh();
  };

  return (
    <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="min-h-11 w-full sm:w-auto md:min-h-0"
        >
          <Link href={workspaceHref}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back to workspace
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 w-full sm:w-auto md:min-h-0"
          onClick={handleRefresh}
          disabled={loading}
          aria-label="Refresh stage"
          title="Refresh stage"
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {loading && !bundle ? (
        <StageSkeletons />
      ) : errorStatus === 403 || errorStatus === 404 ? (
        <Alert>
          <AlertTitle>Not available</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {errorStatus === 403
                ? "This employee is outside your scope, so their evaluation stage is not available to you."
                : "This employee could not be found."}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={workspaceHref}>Back to workspace</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : error || !bundle || !stage ? (
        <Alert variant="destructive">
          <AlertTitle>Stage unavailable</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{error ?? "This stage could not be loaded."}</p>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          <h1 className="text-base font-semibold">
            {stage === "closed" ? "Closing summary" : workflowStageLabel(stage)}
          </h1>
          {stage === "first_evaluation" ? (
            <KpiSheetForm
              scope={scope}
              userId={userId}
              evalType="first"
              bundle={bundle}
              onSaved={refresh}
              readOnly={actionOwnedByOther}
            />
          ) : stage === "second_evaluation" ? (
            <KpiSheetForm
              scope={scope}
              userId={userId}
              evalType="second"
              bundle={bundle}
              onSaved={refresh}
              readOnly={actionOwnedByOther}
            />
          ) : stage === "pip_1" || stage === "pip_2" ? (
            <PipForm
              scope={scope}
              userId={userId}
              bundle={bundle}
              onSaved={refresh}
              readOnly={actionOwnedByOther}
            />
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
            <ClosedStageCard bundle={bundle} />
          )}
        </div>
      )}
    </div>
  );
}
