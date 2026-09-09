"use client";

import React from "react";

import type { TrainingActor } from "./types/training-taking.schema";
import { TrainingAssignmentFetchProvider } from "./providers/trainingAssignmentProvider";
import { TrainingTakingView } from "./components/TrainingTakingView";
import { TrainingOverviewTab } from "./components/TrainingOverviewTab";

// TrainingTakingModule.tsx — Todo 12 role root.
//
// `hiree` renders the taking view (assigned list -> start -> resumable
// in-progress -> submit -> completed with score/pass). `hr` renders the
// per-hire overview (assigned / in-progress / completed + derived overdue).
// Both ride the same fetch provider scoped to the hire; all writes flow
// through the assignment-scoped routes (IDOR: owner mismatch -> 403).

export default function TrainingTakingModule({
  actor,
  scope,
}: {
  actor: TrainingActor;
  scope: { profileId?: number; employeeId?: number };
}): React.ReactNode {
  return (
    <TrainingAssignmentFetchProvider
      employeeId={scope.employeeId}
      profileId={scope.profileId}
    >
      {actor.role === "hr" ? (
        <TrainingOverviewTab profileId={scope.profileId} employeeId={scope.employeeId} />
      ) : (
        <TrainingTakingView actor={actor} />
      )}
    </TrainingAssignmentFetchProvider>
  );
}
