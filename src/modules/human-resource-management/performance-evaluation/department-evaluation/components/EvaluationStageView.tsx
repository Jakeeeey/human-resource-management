"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";

import { useEvaluationWorkspace } from "../hooks/useEvaluationWorkspace";
import {
  EvaluationClientError,
  regularize,
  terminateEmployment,
  type EvaluationScope,
  type TerminationSeparationType,
} from "../providers/evaluationClient";
import type { WorkspaceBundle } from "../types/performance-evaluation.schema";
import { formatHiredDate } from "../utils/probationClock";
import {
  countFailures,
  deriveNextAction,
  deriveProbationStatus,
  deriveStage,
  type WorkflowStage,
} from "../utils/workflow";
import { KpiSheetForm } from "./KpiSheetForm";
import {
  buildWorkflowFacts,
  probationStatusLabel,
  probationStatusTone,
  workflowStageLabel,
} from "./OverviewSection";
import { PipForm } from "./PipForm";
import { RecommendationSection } from "./RecommendationSection";

function stageScopePath(scope: EvaluationScope): string {
  return scope === "hr"
    ? "/hrm/performance-evaluation/admin-evaluation"
    : "/hrm/performance-evaluation/department-evaluation";
}

const TERMINATION_SEPARATION_OPTIONS: { value: TerminationSeparationType; label: string }[] = [
  { value: "failed_probation", label: "Failed probation" },
  { value: "laid_off", label: "Laid off" },
  { value: "resigned", label: "Resigned" },
];

function terminationErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof EvaluationClientError) return err.message;
  return fallback;
}

function TerminationReviewSection({
  scope,
  userId,
  bundle,
  onRefresh,
}: {
  scope: EvaluationScope;
  userId: number;
  bundle: WorkspaceBundle;
  onRefresh: () => void;
}) {
  const [separationType, setSeparationType] = useState<TerminationSeparationType>("failed_probation");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const facts = buildWorkflowFacts(bundle);
  const failures = countFailures(facts);
  const isHr = scope === "hr";

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const trimmed = reason.trim();
      await terminateEmployment(userId, {
        separation_type: separationType,
        termination_reason: trimmed === "" ? null : trimmed,
      });
      toast.success("Termination confirmed");
      onRefresh();
    } catch (err) {
      toast.error(terminationErrorMessage(err, "Failed to confirm the termination."));
    } finally {
      setConfirming(false);
    }
  };

  const handleOverride = async () => {
    setOverriding(true);
    try {
      await regularize(userId);
      toast.success("Employee regularized");
      onRefresh();
    } catch (err) {
      toast.error(terminationErrorMessage(err, "Failed to regularize this employee."));
    } finally {
      setOverriding(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Termination review
          <StatusBadge tone="warning">Subject to termination</StatusBadge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {failures} failures on record (failed evaluations plus failed PIPs). HR must confirm
          the separation and choose its type, or override by regularizing instead.
        </p>
        {isHr ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="termination-separation-type">Separation type</Label>
              <Select
                value={separationType}
                onValueChange={(value) => setSeparationType(value as TerminationSeparationType)}
              >
                <SelectTrigger id="termination-separation-type" className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERMINATION_SEPARATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="termination-reason">Reason</Label>
              <Textarea
                id="termination-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Grounds for the decision"
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="min-h-11 w-full sm:w-auto md:min-h-0"
                disabled={confirming || overriding}
                onClick={() => void handleConfirm()}
              >
                {confirming ? "Saving…" : "Confirm termination"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 w-full sm:w-auto md:min-h-0"
                disabled={confirming || overriding}
                onClick={() => void handleOverride()}
              >
                {overriding ? "Saving…" : "Override — regularize instead"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Awaiting HR — only HR can confirm the termination or override it.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
function ClosedStageCard({ bundle, derivedRegular }: { bundle: WorkspaceBundle; derivedRegular: boolean }) {
  const regular =
    derivedRegular ||
    (bundle.tracking?.regularized_at !== null &&
      bundle.tracking?.regularized_at !== undefined);
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
  const router = useRouter();
  const selected = searchParams.get("selected");
  const workspaceHref =
    selected !== null && selected !== ""
      ? `${stageScopePath(scope)}/${userId}?selected=${encodeURIComponent(selected)}`
      : `${stageScopePath(scope)}/${userId}`;

  const facts = bundle ? buildWorkflowFacts(bundle) : null;
  const stage: WorkflowStage | null = facts ? deriveStage(facts) : null;
  const status = facts ? deriveProbationStatus(facts) : null;
  const action = facts ? deriveNextAction(facts) : null;
  const actionOwnedByOther = action !== null && action.owner !== scope;
  const currentPip =
    bundle && bundle.pips.length > 0
      ? [...bundle.pips].sort((a, b) => b.id - a.id)[0]
      : null;
  const pipPlanStillEditable =
    currentPip !== null &&
    currentPip.status === "open" &&
    currentPip.employee_acknowledged_at == null;
  const pipFormReadOnly = pipPlanStillEditable
    ? scope !== "head"
    : actionOwnedByOther;

  const handleRefresh = () => {
    void refresh();
  };

  const handleSaved = () => {
    router.push(workspaceHref);
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl space-y-6 p-2 sm:p-6 md:p-10">
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
      ) : error || !bundle || !stage || !status ? (
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
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {bundle.employee.date_hired
                    ? `Hired ${formatHiredDate(bundle.employee.date_hired)}`
                    : "No hire date on record"}
                </p>
                <h1 className="truncate text-xl font-semibold">
                  {bundle.employee.full_name}
                </h1>
                {[bundle.employee.department_name, bundle.employee.position]
                  .filter(
                    (part): part is string =>
                      part !== null && part !== undefined && part !== "",
                  )
                  .join(" · ") !== "" ? (
                  <p className="truncate text-sm text-muted-foreground">
                    {[
                      bundle.employee.department_name,
                      bundle.employee.position,
                    ]
                      .filter(
                        (part): part is string =>
                          part !== null && part !== undefined && part !== "",
                      )
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <StatusBadge tone={probationStatusTone(status)}>
                  {probationStatusLabel(status)}
                </StatusBadge>
                <StatusBadge tone={stage === "closed" ? "neutral" : "info"}>
                  {workflowStageLabel(stage)}
                </StatusBadge>
              </div>
            </CardContent>
          </Card>
          {stage === "first_evaluation" ? (
            <KpiSheetForm
              scope={scope}
              userId={userId}
              evalType="first"
              bundle={bundle}
              onSaved={handleSaved}
              readOnly={actionOwnedByOther}
              backHref={workspaceHref}
            />
          ) : stage === "second_evaluation" ? (
            <KpiSheetForm
              scope={scope}
              userId={userId}
              evalType="second"
              bundle={bundle}
              onSaved={handleSaved}
              readOnly={actionOwnedByOther}
              backHref={workspaceHref}
            />
          ) : stage === "third_evaluation" ? (
            <KpiSheetForm
              scope={scope}
              userId={userId}
              evalType="third"
              bundle={bundle}
              onSaved={handleSaved}
              readOnly={actionOwnedByOther}
              backHref={workspaceHref}
            />
          ) : stage === "pip_1" ? (
            <PipForm
              scope={scope}
              userId={userId}
              bundle={bundle}
              onSaved={handleSaved}
              readOnly={pipFormReadOnly}
              backHref={workspaceHref}
            />
          ) : stage === "termination_review" ? (
            <TerminationReviewSection
              scope={scope}
              userId={userId}
              bundle={bundle}
              onRefresh={() => {
                void refresh();
              }}
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
            <ClosedStageCard bundle={bundle} derivedRegular={status === "regular"} />
          )}
        </div>
      )}
    </div>
  );
}
