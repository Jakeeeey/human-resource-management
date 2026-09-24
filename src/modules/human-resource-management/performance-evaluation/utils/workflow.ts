import { hasCompletedProbation } from "./probationClock";

export type ProbationStatus =
  | "probationary"
  | "pip_open"
  | "recommendation_issued"
  | "regular"
  | "terminated";

export type WorkflowStage =
  | "first_evaluation"
  | "pip_1"
  | "second_evaluation"
  | "pip_2"
  | "recommendation"
  | "regularization"
  | "closed";

export interface WorkflowFacts {
  dateHired: string | null;
  regularizedAt: string | null;
  terminatedAt: string | null;
  recommendationIssuedAt: string | null;
  evaluations: readonly {
    evalType: "first" | "second";
    result: "passed" | "failed";
    voidedAt: string | null;
  }[];
  pips: readonly {
    evaluationId: number;
    evalType: "first" | "second";
    status: "open" | "passed" | "failed";
    acknowledgedAt: string | null;
  }[];
}

export interface NextAction {
  key: string;
  label: string;
  owner: "hr" | "head" | "employee";
}

export function deriveProbationStatus(
  f: WorkflowFacts,
  now: Date = new Date()
): ProbationStatus {
  if (f.terminatedAt !== null || f.pips.some((p) => p.status === "failed")) {
    return "terminated";
  }
  if (f.regularizedAt !== null) return "regular";
  if (f.recommendationIssuedAt !== null) return "recommendation_issued";
  if (f.pips.some((p) => p.status === "open")) return "pip_open";
  if (hasCompletedProbation(f.dateHired, now)) return "regular";
  return "probationary";
}

export function deriveStage(f: WorkflowFacts, now: Date = new Date()): WorkflowStage {
  const status = deriveProbationStatus(f, now);
  if (status === "regular" || status === "terminated") return "closed";
  const live = f.evaluations.filter((e) => e.voidedAt === null);
  const first = live.find((e) => e.evalType === "first");
  if (first === undefined) return "first_evaluation";
  if (first.result === "failed") {
    const pip1 = f.pips.find((p) => p.evalType === "first");
    if (pip1 === undefined || pip1.status === "open") return "pip_1";
  }
  const second = live.find((e) => e.evalType === "second");
  if (second === undefined) return "second_evaluation";
  if (second.result === "failed") {
    const pip2 = f.pips.find((p) => p.evalType === "second");
    if (pip2 === undefined || pip2.status === "open") return "pip_2";
  }
  if (f.recommendationIssuedAt !== null) return "regularization";
  return "recommendation";
}

export function deriveNextAction(f: WorkflowFacts, now: Date = new Date()): NextAction | null {
  if (f.pips.some((p) => p.status === "failed")) return null;
  const status = deriveProbationStatus(f, now);
  if (status === "regular" || status === "terminated") return null;
  const live = f.evaluations.filter((e) => e.voidedAt === null);
  const first = live.find((e) => e.evalType === "first");
  if (first === undefined) {
    return { key: "first_evaluation", label: "Conduct 1st evaluation", owner: "head" };
  }
  if (first.result === "failed") {
    const pipAction = pipNextAction(f, "first", "1");
    if (pipAction !== null) return pipAction;
  }
  const second = live.find((e) => e.evalType === "second");
  if (second === undefined) {
    return { key: "second_evaluation", label: "Conduct 2nd evaluation", owner: "head" };
  }
  if (second.result === "failed") {
    const pipAction = pipNextAction(f, "second", "2");
    if (pipAction !== null) return pipAction;
  }
  if (f.recommendationIssuedAt === null) {
    return { key: "recommendation", label: "Issue recommendation letter", owner: "hr" };
  }
  return { key: "regularize", label: "Final approval (regularize)", owner: "hr" };
}

function pipNextAction(
  f: WorkflowFacts,
  evalType: "first" | "second",
  suffix: "1" | "2"
): NextAction | null {
  const pip = f.pips.find((p) => p.evalType === evalType);
  if (pip === undefined) {
    return {
      key: `create_pip_${suffix}`,
      label: `Create PIP #${suffix}`,
      owner: "head",
    };
  }
  if (pip.status !== "open") return null;
  if (pip.acknowledgedAt === null) {
    return {
      key: `acknowledge_pip_${suffix}`,
      label: `Awaiting employee acknowledgement of PIP #${suffix}`,
      owner: "employee",
    };
  }
  return {
    key: `evaluate_pip_${suffix}`,
    label: `Record PIP #${suffix} outcome`,
    owner: "head",
  };
}
