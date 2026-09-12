"use client";

import React from "react";

import type { TrainingActor } from "./types/training-taking.schema";
import { TrainingAssignmentFetchProvider } from "./providers/trainingAssignmentProvider";
import { TrainingTakingView } from "./components/TrainingTakingView";
import { TrainingOverviewTab } from "./components/TrainingOverviewTab";

// TrainingTakingModule.tsx — ownership-scoped training root.
//
// When the actor IS the scoped hire (`scope.userId === actor.user_id`) it
// renders the taking view (assigned list -> start -> resumable in-progress
// -> submit -> completed with score/pass). A different scope renders the
// per-hire overview (assigned / in-progress / completed + derived overdue).
// Rendering is derived from ownership/scope, never from a role — no role
// gate lives in app code (access is external; plan §12). Both branches ride
// the same fetch provider scoped to the hire; all writes flow through the
// assignment-scoped routes (IDOR: owner mismatch -> 403).

export default function TrainingTakingModule({
  actor,
  scope,
}: {
  actor: TrainingActor;
  scope: { userId?: number };
}): React.ReactNode {
  const isOwnScope = scope.userId === actor.user_id;
  return (
    <TrainingAssignmentFetchProvider userId={scope.userId}>
      {isOwnScope ? (
        <TrainingTakingView actor={actor} />
      ) : (
        <TrainingOverviewTab userId={scope.userId} />
      )}
    </TrainingAssignmentFetchProvider>
  );
}
