"use client";

import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

import type { WorkflowFacts, WorkflowStage } from "../utils/workflow";
import { deriveRailNodes, type RailState } from "../utils/rail";

function RailIcon({ state }: { state: RailState }) {
    if (state === "done") return <Check className="h-4 w-4" aria-hidden="true" />;
    if (state === "terminated") return <X className="h-4 w-4" aria-hidden="true" />;
    return <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />;
}

export function StageRail({ facts, stage }: { facts: WorkflowFacts; stage: WorkflowStage }) {
    const nodes = deriveRailNodes(facts, stage);

    return (
        <ol
            aria-label="Probation lifecycle"
            className="flex items-start gap-1 overflow-x-auto rounded-[var(--radius)] border border-border bg-card p-4"
        >
            {nodes.map((node, index) => {
                const state = node.state;
                const previous = index === 0 ? null : (nodes[index - 1]?.state ?? "upcoming");
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
                        {index < nodes.length - 1 ? (
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
