"use client";

import { useMemo } from "react";
import type { JSX } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

import type { WorkspaceBundle } from "../types/performance-evaluation.schema";
import { derivePipPhase } from "../utils/pipGuards";
import { PipOutcomeForm } from "./PipOutcomeForm";
import { PipPlanForm } from "./PipPlanForm";

export function PipForm(props: {
  scope: "hr" | "head";
  userId: number;
  bundle: WorkspaceBundle;
  onSaved: () => void;
  readOnly?: boolean;
}): JSX.Element {
  const { scope, userId, bundle, onSaved, readOnly = false } = props;

  const currentPip = useMemo(() => {
    if (bundle.pips.length === 0) return null;
    return [...bundle.pips].sort((a, b) => b.id - a.id)[0];
  }, [bundle.pips]);

  if (!currentPip) {
    return (
      <PipPlanForm
        scope={scope}
        userId={userId}
        bundle={bundle}
        onSaved={onSaved}
        readOnly={readOnly}
      />
    );
  }

  if (currentPip.status !== "open") {
    return (
      <PipOutcomeForm
        scope={scope}
        userId={userId}
        bundle={bundle}
        onSaved={onSaved}
        readOnly
      />
    );
  }

  const phase = derivePipPhase({
    status: currentPip.status,
    employeeAcknowledgedAt: currentPip.employee_acknowledged_at,
  });

  if (phase === "ready_for_review") {
    return (
      <PipOutcomeForm
        scope={scope}
        userId={userId}
        bundle={bundle}
        onSaved={onSaved}
        readOnly={readOnly}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PipPlanForm
        scope={scope}
        userId={userId}
        bundle={bundle}
        onSaved={onSaved}
        readOnly={readOnly}
      />
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertTitle>Awaiting employee acknowledgement</AlertTitle>
            <AlertDescription>
              The outcome form unlocks after the employee acknowledges this PIP
              plan. Ratings and the overall outcome cannot be recorded before
              then.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
