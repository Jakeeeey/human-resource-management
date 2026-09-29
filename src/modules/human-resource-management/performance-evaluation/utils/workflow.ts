import { hasCompletedProbation } from "./probationClock";

export type EvalType = "first" | "second" | "third";

export type ProbationStatus =
  | "probationary"
  | "pip_open"
  | "recommendation_issued"
  | "subject_to_termination"
  | "regular"
  | "terminated";

export type WorkflowStage =
  | "first_evaluation"
  | "pip_1"
  | "second_evaluation"
  | "third_evaluation"
  | "recommendation"
  | "regularization"
  | "termination_review"
  | "closed";

export interface WorkflowFacts {
  dateHired: string | null;
  regularizedAt: string | null;
  terminatedAt: string | null;
  recommendationIssuedAt: string | null;
  evaluations: readonly {
    evalType: EvalType;
    result: "passed" | "failed";
    voidedAt: string | null;
  }[];
  pips: readonly {
    evaluationId: number;
    evalType: EvalType;
    status: "open" | "passed" | "failed";
    acknowledgedAt: string | null;
  }[];
}

export interface NextAction {
  key: string;
  label: string;
  owner: "hr" | "head" | "employee";
}

export function countFailures(f: WorkflowFacts): number {
  const live = f.evaluations.filter((e) => e.voidedAt === null);
  const failedEvaluations = live.filter((e) => e.result === "failed").length;
  const failedPips = f.pips.filter((p) => p.status === "failed").length;
  return failedEvaluations + failedPips;
}

export function isSubjectToTermination(f: WorkflowFacts): boolean {
  if (f.terminatedAt !== null || f.regularizedAt !== null) return false;
  return countFailures(f) >= 2;
}

export function deriveProbationStatus(
  f: WorkflowFacts,
  now: Date = new Date()
): ProbationStatus {
  if (f.terminatedAt !== null) {
    return "terminated";
  }
  if (f.regularizedAt !== null) return "regular";
  if (isSubjectToTermination(f)) return "subject_to_termination";
  if (f.recommendationIssuedAt !== null) return "recommendation_issued";
  if (f.pips.some((p) => p.status === "open")) return "pip_open";
  if (hasCompletedProbation(f.dateHired, now)) return "regular";
  return "probationary";
}

export function deriveStage(f: WorkflowFacts, now: Date = new Date()): WorkflowStage {
  const status = deriveProbationStatus(f, now);
  if (status === "regular" || status === "terminated") return "closed";
  if (status === "subject_to_termination") return "termination_review";
  const live = f.evaluations.filter((e) => e.voidedAt === null);
  const first = live.find((e) => e.evalType === "first");
  if (first === undefined) return "first_evaluation";
  if (first.result === "failed" && needsPip(f, "first")) return "pip_1";
  const second = live.find((e) => e.evalType === "second");
  if (second === undefined) return "second_evaluation";
  if (second.result === "failed" && needsPip(f, "second")) return "pip_1";
  const third = live.find((e) => e.evalType === "third");
  if (third === undefined) return "third_evaluation";
  if (third.result === "failed" && needsPip(f, "third")) return "pip_1";
  if (f.recommendationIssuedAt !== null) return "regularization";
  return "recommendation";
}

function needsPip(f: WorkflowFacts, evalType: EvalType): boolean {
  const pip = f.pips.find((p) => p.evalType === evalType);
  if (pip !== undefined) return pip.status === "open";
  return f.pips.length === 0;
}

export function deriveNextAction(f: WorkflowFacts, now: Date = new Date()): NextAction | null {
  const status = deriveProbationStatus(f, now);
  if (status === "regular" || status === "terminated") return null;
  if (status === "subject_to_termination") {
    return {
      key: "confirm_termination",
      label: "Confirm termination or override",
      owner: "hr",
    };
  }
  const live = f.evaluations.filter((e) => e.voidedAt === null);
  const first = live.find((e) => e.evalType === "first");
  if (first === undefined) {
    return { key: "first_evaluation", label: "Conduct 1st evaluation", owner: "head" };
  }
  if (first.result === "failed" && needsPip(f, "first")) {
    const pipAction = pipNextAction(f, "first");
    if (pipAction !== null) return pipAction;
  }
  const second = live.find((e) => e.evalType === "second");
  if (second === undefined) {
    return { key: "second_evaluation", label: "Conduct 2nd evaluation", owner: "head" };
  }
  if (second.result === "failed" && needsPip(f, "second")) {
    const pipAction = pipNextAction(f, "second");
    if (pipAction !== null) return pipAction;
  }
  const third = live.find((e) => e.evalType === "third");
  if (third === undefined) {
    return { key: "third_evaluation", label: "Conduct 3rd evaluation", owner: "head" };
  }
  if (third.result === "failed" && needsPip(f, "third")) {
    const pipAction = pipNextAction(f, "third");
    if (pipAction !== null) return pipAction;
  }
  if (f.recommendationIssuedAt === null) {
    return { key: "recommendation", label: "Issue recommendation letter", owner: "hr" };
  }
  return { key: "regularize", label: "Final approval (regularize)", owner: "hr" };
}

function pipNextAction(
  f: WorkflowFacts,
  evalType: EvalType
): NextAction | null {
  const pip = f.pips.find((p) => p.evalType === evalType) ?? (f.pips.length === 0 ? undefined : null);
  if (pip === undefined) {
    return {
      key: "create_pip_1",
      label: "Create PIP",
      owner: "head",
    };
  }
  if (pip === null) return null;
  if (pip.status !== "open") return null;
  if (pip.acknowledgedAt === null) {
    return {
      key: "acknowledge_pip_1",
      label: "Awaiting employee acknowledgement of PIP",
      owner: "employee",
    };
  }
  return {
    key: "evaluate_pip_1",
    label: "Record PIP outcome",
    owner: "head",
  };
}
