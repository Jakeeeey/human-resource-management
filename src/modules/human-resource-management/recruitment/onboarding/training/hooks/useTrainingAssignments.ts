"use client";

import { useMemo } from "react";

import type { TrainingTakingAssignment } from "../types/training-taking.schema";
import { isAssignmentOverdue } from "../trainingAssignmentAdapter";
import { useTrainingAssignmentFetch } from "../providers/trainingAssignmentProvider";

// useTrainingAssignments.ts — hiree/HR selectors over the training
// assignment fetch context. Grouping mirrors the plan's HR overview
// (assigned / in-progress / completed per hire); overdue is the adapter's
// DERIVED flag (never a stored state).

export interface GroupedTrainingAssignments {
  assigned: TrainingTakingAssignment[];
  inProgress: TrainingTakingAssignment[];
  completed: TrainingTakingAssignment[];
  overdueIds: Set<number>;
}

export function useTrainingAssignments(): GroupedTrainingAssignments & {
  all: TrainingTakingAssignment[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
} {
  const { assignments, isLoading, isError, refetch } = useTrainingAssignmentFetch();

  const grouped = useMemo<GroupedTrainingAssignments>(() => {
    const assigned: TrainingTakingAssignment[] = [];
    const inProgress: TrainingTakingAssignment[] = [];
    const completed: TrainingTakingAssignment[] = [];
    const overdueIds = new Set<number>();
    for (const a of assignments) {
      if (a.status === "assigned") assigned.push(a);
      else if (a.status === "in_progress") inProgress.push(a);
      else completed.push(a);
      if (isAssignmentOverdue({ status: a.status, due: a.due })) {
        overdueIds.add(a.id);
      }
    }
    return { assigned, inProgress, completed, overdueIds };
  }, [assignments]);

  return {
    ...grouped,
    all: assignments,
    isLoading,
    isError,
    refetch,
  };
}
