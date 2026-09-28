import type { WorkflowFacts, WorkflowStage } from "./workflow";

export type RailState = "done" | "active" | "upcoming" | "terminated";

export interface RailNode {
  key: string;
  label: string;
  state: RailState;
}

type EvaluationFact = WorkflowFacts["evaluations"][number];
type PipFact = WorkflowFacts["pips"][number];

/**
 * A PIP only ever exists because an evaluation failed — it is the intermediary
 * action a failed evaluation triggers. PIP nodes are therefore conditional:
 * they appear once a PIP exists or once the evaluation that would trigger one
 * has failed. The base pipeline never advertises them up front.
 */
export function deriveRailNodes(facts: WorkflowFacts, stage: WorkflowStage): RailNode[] {
  const live = facts.evaluations.filter((entry) => entry.voidedAt === null);
  const first = live.find((entry) => entry.evalType === "first");
  const second = live.find((entry) => entry.evalType === "second");
  const pip1 = facts.pips.find((pip) => pip.evalType === "first");
  const pip2 = facts.pips.find((pip) => pip.evalType === "second");
  const failed =
    facts.pips.some((pip) => pip.status === "failed") || facts.terminatedAt !== null;
  const unreached: RailState = failed ? "terminated" : "upcoming";

  const pipState = (
    pip: PipFact | undefined,
    evaluation: EvaluationFact | undefined,
  ): RailState => {
    if (pip?.status === "failed") return "terminated";
    if (pip?.status === "passed") return "done";
    if (pip?.status === "open") return "active";
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

  if (pip1 !== undefined || first?.result === "failed") {
    nodes.push({ key: "pip1", label: "PIP #1", state: pipState(pip1, first) });
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

  if (pip2 !== undefined || second?.result === "failed") {
    nodes.push({ key: "pip2", label: "PIP #2", state: pipState(pip2, second) });
  }

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

  return nodes;
}
