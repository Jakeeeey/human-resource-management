import { countFailures } from "./workflow";
import type { WorkflowFacts, WorkflowStage } from "./workflow";

export type RailState = "done" | "active" | "upcoming" | "terminated";

export interface RailNode {
  key: string;
  label: string;
  state: RailState;
}

type EvaluationFact = WorkflowFacts["evaluations"][number];
type PipFact = WorkflowFacts["pips"][number];

export function deriveRailNodes(facts: WorkflowFacts, stage: WorkflowStage): RailNode[] {
  const live = facts.evaluations.filter((entry) => entry.voidedAt === null);
  const first = live.find((entry) => entry.evalType === "first");
  const second = live.find((entry) => entry.evalType === "second");
  const third = live.find((entry) => entry.evalType === "third");
  const pip = facts.pips.length > 0 ? [...facts.pips].sort((a, b) => a.evaluationId - b.evaluationId)[0] : undefined;
  const pipEval: EvaluationFact | undefined =
    pip === undefined
      ? undefined
      : (live.find((entry) => entry.evalType === pip.evalType) ?? first);
  const flagged = countFailures(facts) >= 2 && facts.terminatedAt === null && facts.regularizedAt === null;
  const failed = facts.terminatedAt !== null || flagged;
  const unreached: RailState = failed ? "terminated" : "upcoming";

  const pipState = (
    current: PipFact | undefined,
    evaluation: EvaluationFact | undefined,
  ): RailState => {
    if (current?.status === "failed") return "terminated";
    if (current?.status === "passed") return "done";
    if (current?.status === "open") return "active";
    if (evaluation === undefined) return unreached;
    return failed ? "terminated" : "active";
  };

  const nodes: RailNode[] = [
    {
      key: "first",
      label: "1st Evaluation",
      state: first ? "done" : failed ? "terminated" : "active",
    },
  ];

  if (pip !== undefined || live.some((entry) => entry.result === "failed")) {
    nodes.push({ key: "pip1", label: "PIP", state: pipState(pip, pipEval) });
  }

  nodes.push({
    key: "second",
    label: "2nd Evaluation",
    state: second
      ? "done"
      : failed
        ? "terminated"
        : stage === "second_evaluation"
          ? "active"
          : stage === "closed"
            ? "terminated"
            : "upcoming",
  });

  nodes.push({
    key: "third",
    label: "3rd Evaluation",
    state: third
      ? "done"
      : failed
        ? "terminated"
        : stage === "third_evaluation"
          ? "active"
          : stage === "closed"
            ? "terminated"
            : "upcoming",
  });

  nodes.push({
    key: "recommendation",
    label: "Recommendation",
    state: facts.recommendationIssuedAt
      ? "done"
      : failed
        ? "terminated"
        : stage === "recommendation"
          ? "active"
          : stage === "closed"
            ? "terminated"
            : "upcoming",
  });

  nodes.push({
    key: "regularization",
    label: "Regularization",
    state: facts.regularizedAt
      ? "done"
      : failed
        ? "terminated"
        : stage === "regularization"
          ? "active"
          : stage === "closed"
            ? "terminated"
            : "upcoming",
  });

  if (flagged || facts.terminatedAt !== null) {
    nodes.push({
      key: "termination_review",
      label: "Termination review",
      state: facts.terminatedAt !== null ? "done" : "active",
    });
  }

  return nodes;
}
