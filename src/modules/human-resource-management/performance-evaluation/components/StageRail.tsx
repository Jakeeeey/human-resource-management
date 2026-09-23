"use client";

import { Check, Minus, X } from "lucide-react";

import { cn } from "@/lib/utils";

import type { WorkflowFacts, WorkflowStage } from "../utils/workflow";

export type RailState = "done" | "active" | "upcoming" | "skipped" | "terminated";

const NODES = [
    { key: "first", label: "1st Evaluation" },
    { key: "pip1", label: "PIP #1" },
    { key: "second", label: "2nd Evaluation" },
    { key: "pip2", label: "PIP #2" },
    { key: "recommendation", label: "Recommendation" },
    { key: "regularization", label: "Regularization" },
] as const;

export function deriveRailStates(facts: WorkflowFacts, stage: WorkflowStage): RailState[] {
    const live = facts.evaluations.filter((entry) => entry.voidedAt === null);
    const first = live.find((entry) => entry.evalType === "first");
    const second = live.find((entry) => entry.evalType === "second");
    const pip1 = facts.pips.find((pip) => pip.evalType === "first");
    const pip2 = facts.pips.find((pip) => pip.evalType === "second");
    const failed =
        facts.pips.some((pip) => pip.status === "failed") || facts.terminatedAt !== null;
    const regularized = facts.regularizedAt !== null;
    const unreached: RailState = failed ? "terminated" : "upcoming";

    const firstState: RailState = first ? "done" : failed ? "terminated" : "active";

    let pip1State: RailState;
    if (pip1?.status === "failed") pip1State = "terminated";
    else if (pip1?.status === "passed") pip1State = "done";
    else if (pip1?.status === "open") pip1State = "active";
    else if (!first) pip1State = unreached;
    else if (first.result === "passed") pip1State = "skipped";
    else pip1State = failed ? "terminated" : "active";

    const secondState: RailState = second
        ? "done"
        : failed
          ? "terminated"
          : stage === "second_evaluation"
            ? "active"
            : stage === "closed"
              ? "terminated"
              : "upcoming";

    let pip2State: RailState;
    if (pip2?.status === "failed") pip2State = "terminated";
    else if (pip2?.status === "passed") pip2State = "done";
    else if (pip2?.status === "open") pip2State = "active";
    else if (!second) pip2State = failed || stage === "closed" ? "terminated" : "upcoming";
    else if (second.result === "passed") pip2State = "skipped";
    else pip2State = failed ? "terminated" : "active";

    const recommendationState: RailState = facts.recommendationIssuedAt
        ? "done"
        : failed
          ? "terminated"
          : stage === "recommendation"
            ? "active"
            : stage === "closed"
              ? "terminated"
              : "upcoming";

    const regularizationState: RailState = regularized
        ? "done"
        : failed
          ? "terminated"
          : stage === "regularization"
            ? "active"
            : stage === "closed"
              ? "terminated"
              : "upcoming";

    return [firstState, pip1State, secondState, pip2State, recommendationState, regularizationState];
}

function RailIcon({ state }: { state: RailState }) {
    if (state === "done") return <Check className="h-4 w-4" aria-hidden="true" />;
    if (state === "terminated") return <X className="h-4 w-4" aria-hidden="true" />;
    if (state === "skipped") return <Minus className="h-4 w-4" aria-hidden="true" />;
    return <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />;
}

export function StageRail({ facts, stage }: { facts: WorkflowFacts; stage: WorkflowStage }) {
    const states = deriveRailStates(facts, stage);

    return (
        <ol
            aria-label="Probation lifecycle"
            className="flex items-start gap-1 overflow-x-auto rounded-[var(--radius)] border border-border bg-card p-4"
        >
            {NODES.map((node, index) => {
                const state = states[index] ?? "upcoming";
                const previous = index === 0 ? null : (states[index - 1] ?? "upcoming");
                return (
                    <li
                        key={node.key}
                        aria-current={state === "active" ? "step" : undefined}
                        className="flex min-w-24 flex-1 items-start"
                    >
                        {index > 0 ? (
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "mt-4 h-0.5 min-w-3 flex-1 transition-colors",
                                    previous === "done" ? "bg-primary" : "bg-border",
                                )}
                            />
                        ) : null}
                        <span className="flex flex-col items-center gap-1.5 text-center">
                            <span
                                className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                                    state === "done" &&
                                        "border-primary bg-primary text-primary-foreground",
                                    state === "active" &&
                                        "border-primary bg-primary/15 text-primary ring-2 ring-primary/40",
                                    state === "upcoming" &&
                                        "border-dashed border-muted-foreground/50 text-muted-foreground",
                                    state === "skipped" && "border-border bg-muted text-muted-foreground",
                                    state === "terminated" &&
                                        "border-destructive bg-destructive text-destructive-foreground",
                                )}
                            >
                                <RailIcon state={state} />
                            </span>
                            <span
                                className={cn(
                                    "text-xs whitespace-nowrap",
                                    state === "active"
                                        ? "font-semibold text-foreground"
                                        : state === "skipped"
                                          ? "text-muted-foreground line-through"
                                          : state === "upcoming"
                                            ? "text-muted-foreground"
                                            : state === "terminated"
                                              ? "font-medium text-destructive"
                                              : "font-medium text-foreground",
                                )}
                            >
                                {node.label}
                            </span>
                            <span className="sr-only">{state}</span>
                        </span>
                        {index < NODES.length - 1 ? (
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "mt-4 h-0.5 min-w-3 flex-1 transition-colors",
                                    state === "done" ? "bg-primary" : "bg-border",
                                )}
                            />
                        ) : null}
                    </li>
                );
            })}
        </ol>
    );
}
