import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { nowUTC } from "@/modules/human-resource-management/shared/utils/audit";
import {
    EmployeeEvaluationSchema,
    EmployeePipSchema,
    type EmployeeEvaluation,
    type EmployeePip,
} from "../types/performance-evaluation.schema";
import type {
    PerformanceDashboardAttention,
    PerformanceDashboardBandCount,
    PerformanceDashboardBinCount,
    PerformanceDashboardBundle,
    PerformanceDashboardDepartment,
    PerformanceDashboardPerformer,
    PerformanceDashboardTrendPoint,
} from "../types/performance-dashboard.schema";
import { ratingBand } from "../utils/kpiScore";
import {
    countFailures,
    type EvalType,
    type WorkflowFacts,
} from "../utils/workflow";
import { EVALUATION_ERROR_CODES, unwrapData } from "./evaluationApiServer";
import type { EvaluationCapability } from "./evaluationCapability";
import { listEvaluationRoster } from "./evaluation-service";

const BAND_ORDER = [
    "Outstanding",
    "Very Good",
    "Satisfactory",
    "Needs Improvement",
    "Unsatisfactory",
];

const ACTIVE_PROBATION_STATUSES = new Set([
    "probationary",
    "pip_open",
    "recommendation_issued",
    "subject_to_termination",
]);

const TOP_PERFORMER_LIMIT = 5;
const TREND_PERIOD_LIMIT = 12;

const SCORE_BIN_LABELS = [
    "1.0–1.5",
    "1.5–2.0",
    "2.0–2.5",
    "2.5–3.0",
    "3.0–3.5",
    "3.5–4.0",
    "4.0–4.5",
    "4.5–5.0",
];

const DashboardDepartmentSchema = z.object({
    department_id: z.number().int(),
    department_name: z.string().nullish(),
});

interface DepartmentBucket {
    departmentId: number | null;
    rosterName: string | null;
    memberIds: number[];
}

interface ScoredUser {
    userId: number;
    score: number;
    band: string;
}

function parseRowList<T>(schema: z.ZodType<T>, body: unknown, label: string): T[] {
    const rows = unwrapData<unknown>(body);
    if (!Array.isArray(rows)) {
        throw new Error(
            `${EVALUATION_ERROR_CODES.readFailed}: ${label} read failed`
        );
    }
    return rows.map((entry) => {
        const parsed = schema.safeParse(entry);
        if (!parsed.success) {
            throw new Error(
                `${EVALUATION_ERROR_CODES.readFailed}: ${label} row contract mismatch`
            );
        }
        return parsed.data;
    });
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function round1(value: number): number {
    return Math.round(value * 10) / 10;
}

function mean(values: readonly number[]): number | null {
    if (values.length === 0) return null;
    let total = 0;
    for (const value of values) total += value;
    return total / values.length;
}

function toPeriod(value: string): string | null {
    const period = value.slice(0, 7);
    return /^\d{4}-\d{2}$/.test(period) ? period : null;
}

function isHighBand(band: string | null): boolean {
    return band === "Outstanding" || band === "Very Good";
}

function pushToBucket(map: Map<number, EmployeeEvaluation[]>, evaluation: EmployeeEvaluation): void {
    const bucket = map.get(evaluation.user_id);
    if (bucket === undefined) map.set(evaluation.user_id, [evaluation]);
    else bucket.push(evaluation);
}

function pushPipToBucket(map: Map<number, EmployeePip[]>, pip: EmployeePip): void {
    const bucket = map.get(pip.user_id);
    if (bucket === undefined) map.set(pip.user_id, [pip]);
    else bucket.push(pip);
}

function toWorkflowFacts(
    userEvaluations: readonly EmployeeEvaluation[],
    userPips: readonly EmployeePip[],
    evalTypeById: ReadonlyMap<number, EvalType>
): WorkflowFacts {
    return {
        dateHired: null,
        regularizedAt: null,
        terminatedAt: null,
        recommendationIssuedAt: null,
        evaluations: userEvaluations.map((evaluation) => ({
            evalType: evaluation.eval_type,
            result: evaluation.result,
            voidedAt: evaluation.voided_at,
        })),
        pips: userPips.map((pip) => ({
            evaluationId: pip.evaluation_id,
            evalType: evalTypeById.get(pip.evaluation_id) ?? "first",
            status: pip.status,
            acknowledgedAt: pip.employee_acknowledged_at,
        })),
    };
}

export async function getPerformanceDashboard(
    cap: EvaluationCapability
): Promise<PerformanceDashboardBundle> {
    const roster = await listEvaluationRoster(cap, { includeRegular: true });
    const [evaluationBody, pipBody, departmentBody] = await Promise.all([
        dFetch("/items/employee_evaluation?limit=-1"),
        dFetch("/items/employee_pip?limit=-1"),
        dFetch("/items/department?fields=department_id,department_name&limit=-1"),
    ]);
    const evaluations = parseRowList(
        EmployeeEvaluationSchema,
        evaluationBody,
        "employee_evaluation"
    );
    const pipRows = parseRowList(EmployeePipSchema, pipBody, "employee_pip");
    const departments = parseRowList(
        DashboardDepartmentSchema,
        departmentBody,
        "department"
    );

    const rosterById = new Map(roster.map((row) => [row.user_id, row]));
    const inScope = new Set(rosterById.keys());

    const voidedEvaluationIds = new Set<number>();
    for (const evaluation of evaluations) {
        if (evaluation.voided_at !== null) voidedEvaluationIds.add(evaluation.id);
    }
    const liveEvaluations = evaluations.filter(
        (evaluation) =>
            evaluation.voided_at === null && inScope.has(evaluation.user_id)
    );
    const scopedPips = pipRows.filter(
        (pip) =>
            inScope.has(pip.user_id) && !voidedEvaluationIds.has(pip.evaluation_id)
    );

    const departmentNames = new Map<number, string>();
    for (const department of departments) {
        const name = department.department_name?.trim() || null;
        if (name !== null) departmentNames.set(department.department_id, name);
    }

    const sortedLive = [...liveEvaluations].sort((left, right) => {
        if (left.evaluation_date !== right.evaluation_date) {
            return left.evaluation_date < right.evaluation_date ? -1 : 1;
        }
        return left.id - right.id;
    });
    const latestByUser = new Map<number, EmployeeEvaluation>();
    for (const evaluation of sortedLive) {
        latestByUser.set(evaluation.user_id, evaluation);
    }
    const bandByUser = new Map<number, string>();
    for (const [userId, evaluation] of latestByUser) {
        const band = ratingBand(evaluation.total_score) ?? evaluation.rating_band;
        if (band !== null) bandByUser.set(userId, band);
    }

    const evaluatedUserIds = [...latestByUser.keys()];
    const avgScore = mean(liveEvaluations.map((evaluation) => evaluation.total_score));
    const roundedAvg = avgScore === null ? null : round2(avgScore);
    const highCount = evaluatedUserIds.filter((userId) =>
        isHighBand(bandByUser.get(userId) ?? null)
    ).length;

    const trendGroups = new Map<string, number[]>();
    for (const evaluation of liveEvaluations) {
        const period = toPeriod(evaluation.evaluation_date);
        if (period === null) continue;
        const bucket = trendGroups.get(period);
        if (bucket === undefined) trendGroups.set(period, [evaluation.total_score]);
        else bucket.push(evaluation.total_score);
    }
    const trend: PerformanceDashboardTrendPoint[] = [...trendGroups.entries()]
        .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))
        .slice(-TREND_PERIOD_LIMIT)
        .map(([period, scores]) => {
            const periodAvg = mean(scores);
            return {
                period,
                avg_score: periodAvg === null ? null : round2(periodAvg),
                count: scores.length,
            };
        });

    const buckets = new Map<string, DepartmentBucket>();
    for (const row of roster) {
        const key = row.department_id === null ? "unassigned" : String(row.department_id);
        const bucket = buckets.get(key);
        if (bucket === undefined) {
            buckets.set(key, {
                departmentId: row.department_id,
                rosterName: row.department_name,
                memberIds: [row.user_id],
            });
        } else {
            bucket.memberIds.push(row.user_id);
            if (bucket.rosterName === null && row.department_name !== null) {
                bucket.rosterName = row.department_name;
            }
        }
    }
    const byDepartment: PerformanceDashboardDepartment[] = [...buckets.values()].map(
        (bucket) => {
            const scores: number[] = [];
            let high = 0;
            let evaluated = 0;
            for (const userId of bucket.memberIds) {
                const latest = latestByUser.get(userId);
                if (latest === undefined) continue;
                evaluated += 1;
                scores.push(latest.total_score);
                if (isHighBand(bandByUser.get(userId) ?? null)) high += 1;
            }
            const deptAvg = mean(scores);
            const resolvedName =
                bucket.rosterName ??
                (bucket.departmentId === null
                    ? null
                    : (departmentNames.get(bucket.departmentId) ?? null));
            return {
                department_id: bucket.departmentId,
                department_name:
                    resolvedName ??
                    (bucket.departmentId === null
                        ? "Unassigned"
                        : `Department ${bucket.departmentId}`),
                avg_score: deptAvg === null ? null : round2(deptAvg),
                count: evaluated,
                high_performer_pct:
                    evaluated === 0 ? null : round1((high / evaluated) * 100),
            };
        }
    );
    byDepartment.sort((left, right) => {
        if (left.avg_score === null && right.avg_score === null) {
            return left.department_name.localeCompare(right.department_name);
        }
        if (left.avg_score === null) return 1;
        if (right.avg_score === null) return -1;
        if (right.avg_score !== left.avg_score) return right.avg_score - left.avg_score;
        return left.department_name.localeCompare(right.department_name);
    });

    const ratingDistribution: PerformanceDashboardBandCount[] = BAND_ORDER.map(
        (band) => ({ band, count: 0 })
    );
    for (const userId of evaluatedUserIds) {
        const band = bandByUser.get(userId) ?? null;
        if (band === null) continue;
        const entry = ratingDistribution.find((row) => row.band === band);
        if (entry !== undefined) entry.count += 1;
    }

    const scoreDistribution: PerformanceDashboardBinCount[] = SCORE_BIN_LABELS.map(
        (bin) => ({ bin, count: 0 })
    );
    for (const evaluation of liveEvaluations) {
        const score: unknown = evaluation.total_score;
        if (typeof score !== "number" || !Number.isFinite(score)) continue;
        let index = Math.floor((score - 1) / 0.5);
        if (index < 0) index = 0;
        if (index > 7) index = 7;
        const entry = scoreDistribution[index];
        if (entry !== undefined) entry.count += 1;
    }

    const scored: ScoredUser[] = [];
    for (const userId of evaluatedUserIds) {
        const latest = latestByUser.get(userId);
        const band = bandByUser.get(userId) ?? null;
        if (latest === undefined || band === null) continue;
        scored.push({ userId, score: latest.total_score, band });
    }
    scored.sort((left, right) => right.score - left.score || left.userId - right.userId);
    const topPerformers: PerformanceDashboardPerformer[] = scored
        .slice(0, TOP_PERFORMER_LIMIT)
        .map((entry) => {
            const profile = rosterById.get(entry.userId);
            return {
                user_id: entry.userId,
                name: profile?.full_name ?? `User ${entry.userId}`,
                department_name: profile?.department_name ?? null,
                score: entry.score,
                band: entry.band,
            };
        });

    const evalTypeById = new Map<number, EvalType>();
    for (const evaluation of evaluations) {
        evalTypeById.set(evaluation.id, evaluation.eval_type);
    }
    const evaluationsByUser = new Map<number, EmployeeEvaluation[]>();
    for (const evaluation of evaluations) {
        if (inScope.has(evaluation.user_id)) pushToBucket(evaluationsByUser, evaluation);
    }
    const userPipsByUser = new Map<number, EmployeePip[]>();
    for (const pip of pipRows) {
        if (inScope.has(pip.user_id)) pushPipToBucket(userPipsByUser, pip);
    }
    const openPipUserIds = new Set<number>();
    for (const pip of scopedPips) {
        if (pip.status === "open") openPipUserIds.add(pip.user_id);
    }
    const needsAttention: PerformanceDashboardAttention[] = [];
    for (const row of roster) {
        const isSubject = row.probation_status === "subject_to_termination";
        const hasOpenPip = openPipUserIds.has(row.user_id);
        if (!isSubject && !hasOpenPip) continue;
        let reason = "Open performance improvement plan";
        if (isSubject) {
            const facts = toWorkflowFacts(
                evaluationsByUser.get(row.user_id) ?? [],
                userPipsByUser.get(row.user_id) ?? [],
                evalTypeById
            );
            const failures = countFailures(facts);
            reason = `Failed ${failures} evaluation${failures === 1 ? "" : "s"}`;
        }
        needsAttention.push({
            user_id: row.user_id,
            name: row.full_name,
            department_name: row.department_name,
            status: row.probation_status,
            reason,
        });
    }
    needsAttention.sort((left, right) => {
        const leftRank = left.status === "subject_to_termination" ? 0 : 1;
        const rightRank = right.status === "subject_to_termination" ? 0 : 1;
        if (leftRank !== rightRank) return leftRank - rightRank;
        const nameDelta = left.name.localeCompare(right.name);
        return nameDelta !== 0 ? nameDelta : left.user_id - right.user_id;
    });

    return {
        generated_at: nowUTC(),
        scope: cap.visibleDepartmentIds === null ? "hr" : "head",
        kpis: {
            total: roster.length,
            evaluated_count: evaluatedUserIds.length,
            avg_score: roundedAvg,
            avg_score_band: roundedAvg === null ? null : ratingBand(roundedAvg),
            probation_count: roster.filter((row) =>
                ACTIVE_PROBATION_STATUSES.has(row.probation_status)
            ).length,
            high_performer_pct:
                evaluatedUserIds.length === 0
                    ? null
                    : round1((highCount / evaluatedUserIds.length) * 100),
            attention_count: needsAttention.length,
        },
        trend,
        by_department: byDepartment,
        rating_distribution: ratingDistribution,
        score_distribution: scoreDistribution,
        top_performers: topPerformers,
        needs_attention: needsAttention,
        pips: {
            open: scopedPips.filter((pip) => pip.status === "open").length,
            passed: scopedPips.filter((pip) => pip.status === "passed").length,
            failed: scopedPips.filter((pip) => pip.status === "failed").length,
        },
    };
}
