import type { ProbationStatus, ProbationSummary, StatusCount } from "../types";
import type { EvaluationRow, PipRow, TrackingRow } from "./rows";
import { norm } from "./dates";

export type ProbationFacts = {
    readonly dateHired: string | null;
    readonly regularizedAt: string | null;
    readonly terminatedAt: string | null;
    readonly recommendationIssuedAt: string | null;
    readonly failures: number;
    readonly pipOpen: boolean;
};

export function hasCompletedProbation(dateHired: string | null, now: Date): boolean {
    if (dateHired === null) return false;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateHired.trim());
    if (match === null || match[1] === undefined || match[2] === undefined || match[3] === undefined) return false;
    const hired = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const end = new Date(hired.getFullYear(), hired.getMonth() + 6, hired.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return end.getTime() <= today.getTime();
}

export function deriveProbationStatus(facts: ProbationFacts): ProbationStatus {
    if (facts.terminatedAt !== null) return "terminated";
    if (facts.regularizedAt !== null) return "regular";
    if (facts.failures >= 2) return "subject_to_termination";
    if (facts.recommendationIssuedAt !== null) return "recommendation_issued";
    if (facts.pipOpen) return "pip_open";
    if (hasCompletedProbation(facts.dateHired, new Date())) return "regular";
    return "probationary";
}

export function buildProbation(
    tracking: readonly TrackingRow[],
    evaluations: readonly EvaluationRow[],
    pips: readonly PipRow[]
): ProbationSummary {
    const failuresByUser = new Map<number, number>();
    for (const entry of evaluations) {
        if (entry.user_id === null) continue;
        if (norm(entry.voided_at) !== null) continue;
        if (norm(entry.result) !== "failed") continue;
        failuresByUser.set(entry.user_id, (failuresByUser.get(entry.user_id) ?? 0) + 1);
    }
    const pipOpenByUser = new Set<number>();
    for (const pip of pips) {
        if (pip.user_id === null) continue;
        const status = norm(pip.status);
        if (status === "open") pipOpenByUser.add(pip.user_id);
        if (status === "failed") {
            failuresByUser.set(pip.user_id, (failuresByUser.get(pip.user_id) ?? 0) + 1);
        }
    }
    const tallies = new Map<ProbationStatus, number>();
    for (const row of tracking) {
        const status = deriveProbationStatus({
            dateHired: norm(row.date_hired_snapshot),
            regularizedAt: norm(row.regularized_at),
            terminatedAt: norm(row.terminated_at),
            recommendationIssuedAt: norm(row.recommendation_issued_at),
            failures: row.user_id === null ? 0 : failuresByUser.get(row.user_id) ?? 0,
            pipOpen: row.user_id !== null && pipOpenByUser.has(row.user_id),
        });
        tallies.set(status, (tallies.get(status) ?? 0) + 1);
    }
    const byStatus: StatusCount[] = [...tallies.entries()].map(([status, count]) => ({ status, count }));
    return { byStatus, tracked: tracking.length };
}

export function countPendingAcknowledgement(pips: readonly PipRow[]): number {
    return pips.filter((pip) => {
        if (norm(pip.status)?.toLowerCase() !== "open") return false;
        return norm(pip.employee_acknowledged_at) === null;
    }).length;
}
