"use client";

import { useState } from "react";
import { History } from "lucide-react";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";

import type { WorkspaceBundle } from "../types/performance-evaluation.schema";

const PLAN_RESULT_LABELS = {
    met: "Met",
    partially_met: "Partially met",
    not_met: "Not met",
} as const;

function evaluationTriggerLabel(evalType: string, date: string): string {
    return `${evalType === "first" ? "1st" : "2nd"} evaluation · ${date}`;
}

type OutcomeFilter = "all" | "passed" | "failed" | "open" | "voided";

function evaluationOutcome(entry: { result: string; voided_at: string | null }): OutcomeFilter {
    if (entry.voided_at) return "voided";
    return entry.result === "passed" ? "passed" : "failed";
}

function pipOutcome(pip: { status: string }): OutcomeFilter {
    if (pip.status === "passed") return "passed";
    if (pip.status === "failed") return "failed";
    return "open";
}

export function HistoryPanel({ bundle }: { bundle: WorkspaceBundle }) {
    const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
    const orderedEvaluations = [...bundle.evaluations].sort((left, right) =>
        left.eval_type === right.eval_type
            ? left.evaluation_date.localeCompare(right.evaluation_date)
            : left.eval_type === "first"
              ? -1
              : 1,
    );
    const orderedPips = [...bundle.pips].sort((left, right) => left.id - right.id);
    const totalCount = orderedEvaluations.length + orderedPips.length;
    const showFilter = totalCount > 7;
    const visibleEvaluations = showFilter && outcomeFilter !== "all"
        ? orderedEvaluations.filter((entry) => evaluationOutcome(entry) === outcomeFilter)
        : orderedEvaluations;
    const visiblePips = showFilter && outcomeFilter !== "all"
        ? orderedPips.filter((pip) => pipOutcome(pip) === outcomeFilter)
        : orderedPips;
    const isEmpty = orderedEvaluations.length === 0 && orderedPips.length === 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent>
                {isEmpty ? (
                    <div className="flex items-start gap-3 text-sm text-muted-foreground">
                        <History className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <p>Nothing completed yet — finished evaluations and PIPs will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                    {showFilter ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <Label htmlFor="history-outcome-filter" className="text-xs text-muted-foreground">
                                Filter by outcome
                            </Label>
                            <Select
                                value={outcomeFilter}
                                onValueChange={(value) => setOutcomeFilter(value as OutcomeFilter)}
                            >
                                <SelectTrigger id="history-outcome-filter" className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All outcomes</SelectItem>
                                    <SelectItem value="passed">Passed</SelectItem>
                                    <SelectItem value="failed">Failed</SelectItem>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="voided">Voided</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    ) : null}
                    {visibleEvaluations.length === 0 && visiblePips.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No history entries match this outcome yet.
                        </p>
                    ) : null}
                    <Accordion type="multiple" className="w-full">
                        {visibleEvaluations.map((entry) => (
                            <AccordionItem key={`eval-${entry.id}`} value={`eval-${entry.id}`}>
                                <AccordionTrigger>
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span>{evaluationTriggerLabel(entry.eval_type, entry.evaluation_date)}</span>
                                        {entry.voided_at ? (
                                            <StatusBadge tone="neutral">Voided</StatusBadge>
                                        ) : (
                                            <StatusBadge
                                                tone={entry.result === "passed" ? "success" : "destructive"}
                                            >
                                                {entry.result === "passed" ? "Passed" : "Failed"}
                                            </StatusBadge>
                                        )}
                                    </span>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <dl className="space-y-2 text-sm">
                                        <div className="flex items-center justify-between gap-2">
                                            <dt className="text-muted-foreground">Date</dt>
                                            <dd className="font-medium tabular-nums">{entry.evaluation_date}</dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <dt className="text-muted-foreground">Total score</dt>
                                            <dd className="font-medium tabular-nums">
                                                {entry.total_score}
                                                {entry.rating_band ? ` · ${entry.rating_band}` : ""}
                                            </dd>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <dt className="text-muted-foreground">Result</dt>
                                            <dd>
                                                {entry.voided_at ? (
                                                    <StatusBadge tone="neutral">Voided</StatusBadge>
                                                ) : (
                                                    <StatusBadge
                                                        tone={entry.result === "passed" ? "success" : "destructive"}
                                                    >
                                                        {entry.result === "passed" ? "Passed" : "Failed"}
                                                    </StatusBadge>
                                                )}
                                            </dd>
                                        </div>
                                        {entry.evaluator_comments ? (
                                            <div className="space-y-1">
                                                <dt className="text-muted-foreground">Comments</dt>
                                                <dd className="text-foreground">{entry.evaluator_comments}</dd>
                                            </div>
                                        ) : null}
                                    </dl>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                        {visiblePips.map((pip) => {
                            const areas = bundle.pipAreas
                                .filter((area) => area.pip_id === pip.id)
                                .sort((left, right) => left.sort_order - right.sort_order);
                            const plans = bundle.pipActionPlans
                                .filter((plan) => plan.pip_id === pip.id)
                                .sort((left, right) => left.sort_order - right.sort_order);
                            const dateRange = [pip.pip_start_date, pip.pip_end_date]
                                .filter((part) => part !== null && part !== "")
                                .join(" → ");
                            const dates = dateRange === "" ? "—" : dateRange;
                            const triggerTitle = dateRange === ""
                                ? "PIP · outcome recorded"
                                : `PIP · ${dateRange}`;
                            return (
                                <AccordionItem key={`pip-${pip.id}`} value={`pip-${pip.id}`}>
                                    <AccordionTrigger>
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span>{triggerTitle}</span>
                                            <StatusBadge
                                                tone={
                                                    pip.status === "passed"
                                                        ? "success"
                                                        : pip.status === "failed"
                                                          ? "destructive"
                                                          : "warning"
                                                }
                                            >
                                                {pip.status === "open"
                                                    ? "Open"
                                                    : pip.status === "passed"
                                                      ? "Passed"
                                                      : "Failed"}
                                            </StatusBadge>
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 text-sm">
                                            <dl className="space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <dt className="text-muted-foreground">PIP dates</dt>
                                                    <dd className="font-medium tabular-nums">{dates}</dd>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <dt className="text-muted-foreground">Outcome</dt>
                                                    <dd>
                                                        <StatusBadge
                                                            tone={
                                                                pip.status === "passed"
                                                                    ? "success"
                                                                    : pip.status === "failed"
                                                                      ? "destructive"
                                                                      : "warning"
                                                            }
                                                        >
                                                            {pip.status === "open"
                                                                ? "Open"
                                                                : pip.status === "passed"
                                                                  ? "Passed"
                                                                  : "Failed"}
                                                        </StatusBadge>
                                                    </dd>
                                                </div>
                                            </dl>
                                            {areas.length > 0 ? (
                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground">Improvement areas</p>
                                                    <ul className="list-disc space-y-1 pl-5">
                                                        {areas.map((area) => (
                                                            <li key={area.id}>{area.area_name_snapshot}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ) : null}
                                            {plans.length > 0 ? (
                                                <div className="space-y-2">
                                                    <p className="text-muted-foreground">Action plans</p>
                                                    <table className="data-grid w-full">
                                                        <thead>
                                                            <tr>
                                                                <th scope="col">Area</th>
                                                                <th scope="col">Action plan</th>
                                                                <th scope="col">Review</th>
                                                                <th scope="col">Result</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {plans.map((plan) => (
                                                                <tr key={plan.id}>
                                                                    <td>{plan.area_for_improvement}</td>
                                                                    <td>{plan.action_plan ?? "—"}</td>
                                                                    <td className="tabular-nums">
                                                                        {plan.review_date ?? "—"}
                                                                    </td>
                                                                    <td>
                                                                        {plan.result
                                                                            ? PLAN_RESULT_LABELS[plan.result]
                                                                            : "—"}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : null}
                                            {pip.detailed_concerns ? (
                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground">Concerns</p>
                                                    <p className="text-foreground">{pip.detailed_concerns}</p>
                                                </div>
                                            ) : null}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
