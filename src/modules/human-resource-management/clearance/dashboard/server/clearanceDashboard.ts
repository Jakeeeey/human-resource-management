import { z } from "zod";

import { dFetch } from "../utils/directus";
import { nowUTC } from "../utils/audit";
import { toPHPeriod } from "../utils/time";
import type {
    ClearanceDashboardAgingBin,
    ClearanceDashboardBundle,
    ClearanceDashboardOldestOpen,
    ClearanceDashboardStatusSlice,
    ClearanceDashboardTemplateRow,
    ClearanceDashboardTrendPoint,
} from "../types/clearance-dashboard.schema";
import type { ClearanceCapability } from "./capability";

const DashboardRequestSchema = z.object({
    id: z.number(),
    resignation_id: z.number(),
    user_id: z.number(),
    template_id: z.number(),
    template_title_snapshot: z.string().nullable(),
    status: z.enum(["pending", "in_progress", "completed"]),
    confirmed_at: z.string().nullable(),
    created_at: z.string().nullable(),
});

const DashboardItemSchema = z.object({
    id: z.number(),
    request_id: z.number(),
    status: z.enum(["pending", "signed"]),
});

const DashboardTemplateSchema = z.object({
    id: z.number(),
    title: z.string(),
});

const DashboardUserSchema = z.object({
    user_id: z.number(),
    user_fname: z.string().nullish(),
    user_mname: z.string().nullish(),
    user_lname: z.string().nullish(),
});

type DashboardRequest = z.infer<typeof DashboardRequestSchema>;
type DashboardItem = z.infer<typeof DashboardItemSchema>;

const TREND_PERIOD_LIMIT = 12;
const OLDEST_OPEN_LIMIT = 5;
const STALE_AFTER_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const AGING_BIN_LABELS = [
    "0–6 days",
    "7–13 days",
    "14–20 days",
    "21–27 days",
    "28+ days",
];

function parseRowList<T>(schema: z.ZodType<T>, body: unknown, label: string): T[] {
    const raw = unwrapRows(body);
    if (!Array.isArray(raw)) {
        throw new Error(`CLEARANCE_READ_FAILED: ${label} read failed`);
    }
    return raw.map((entry) => {
        const parsed = schema.safeParse(entry);
        if (!parsed.success) {
            throw new Error(`CLEARANCE_READ_FAILED: ${label} row contract mismatch`);
        }
        return parsed.data;
    });
}

function unwrapRows(body: unknown): unknown {
    if (typeof body === "object" && body !== null && "errors" in body) {
        const errors = (body as { errors?: Array<{ message?: string }> }).errors;
        if (Array.isArray(errors) && errors.length > 0) {
            throw new Error(
                `CLEARANCE_READ_FAILED: ${errors.map((entry) => entry.message ?? "unknown error").join("; ")}`
            );
        }
    }
    if (typeof body === "object" && body !== null && "data" in body) {
        return (body as { data: unknown }).data;
    }
    throw new Error(
        `CLEARANCE_READ_FAILED: unexpected response shape (${JSON.stringify(body).slice(0, 300)})`
    );
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

function toPeriod(value: string | null): string | null {
    if (value === null) return null;
    const period = toPHPeriod(value);
    return period !== null && /^\d{4}-\d{2}$/.test(period) ? period : null;
}

function toInstantMs(value: string | null): number | null {
    if (value === null || value.trim() === "") return null;
    const instant = new Date(value).getTime();
    return Number.isNaN(instant) ? null : instant;
}

function templateTitleFor(
    templateId: number,
    snapshots: readonly (string | null)[]
): string {
    for (const snapshot of snapshots) {
        if (snapshot !== null && snapshot.trim() !== "") return snapshot;
    }
    return "Untitled template";
}

export async function getClearanceDashboard(
    cap: ClearanceCapability
): Promise<ClearanceDashboardBundle> {
    const [requestBody, itemBody, templateBody, userBody] = await Promise.all([
        dFetch(
            "/items/clearance_request?fields=id,resignation_id,user_id,template_id,template_title_snapshot,status,confirmed_at,created_at&limit=-1"
        ),
        dFetch("/items/clearance_item?fields=id,request_id,status&limit=-1"),
        dFetch("/items/clearance_template?fields=id,title&limit=-1"),
        dFetch("/items/user?fields=user_id,user_fname,user_mname,user_lname&limit=-1"),
    ]);
    const requests = parseRowList(DashboardRequestSchema, requestBody, "clearance_request");
    const items = parseRowList(DashboardItemSchema, itemBody, "clearance_item");
    const templates = parseRowList(DashboardTemplateSchema, templateBody, "clearance_template");
    const users = parseRowList(DashboardUserSchema, userBody, "user");

    const nowMs = Date.now();
    const generatedAt = nowUTC();

    const namesByUser = new Map<number, string>();
    for (const user of users) {
        const name = [user.user_fname, user.user_mname, user.user_lname]
            .map((part) => part?.trim() ?? "")
            .filter((part) => part !== "")
            .join(" ");
        if (name !== "") namesByUser.set(user.user_id, name);
    }

    const titlesByTemplate = new Map<number, string>();
    for (const template of templates) {
        titlesByTemplate.set(template.id, template.title);
    }

    const itemsByRequest = new Map<number, DashboardItem[]>();
    for (const item of items) {
        const bucket = itemsByRequest.get(item.request_id);
        if (bucket === undefined) itemsByRequest.set(item.request_id, [item]);
        else bucket.push(item);
    }

    const snapshotsByTemplate = new Map<number, (string | null)[]>();
    for (const request of requests) {
        const bucket = snapshotsByTemplate.get(request.template_id);
        if (bucket === undefined) snapshotsByTemplate.set(request.template_id, [request.template_title_snapshot]);
        else bucket.push(request.template_title_snapshot);
    }

    let completedCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;
    const confirmDays: number[] = [];
    let staleUnsignedCount = 0;

    const trendGroups = new Map<string, number>();

    interface OpenAge {
        request: DashboardRequest;
        daysOpen: number;
    }
    const openAges: OpenAge[] = [];

    for (const request of requests) {
        if (request.status === "completed") completedCount += 1;
        else if (request.status === "in_progress") inProgressCount += 1;
        else notStartedCount += 1;

        const period = toPeriod(request.created_at);
        if (period !== null) {
            trendGroups.set(period, (trendGroups.get(period) ?? 0) + 1);
        }

        const createdMs = toInstantMs(request.created_at);
        if (request.status === "completed") {
            const confirmedMs = toInstantMs(request.confirmed_at);
            if (createdMs !== null && confirmedMs !== null && confirmedMs >= createdMs) {
                confirmDays.push((confirmedMs - createdMs) / DAY_MS);
            }
        } else if (createdMs !== null) {
            const daysOpen = Math.max(0, Math.floor((nowMs - createdMs) / DAY_MS));
            openAges.push({ request, daysOpen });
            const requestItems = itemsByRequest.get(request.id) ?? [];
            const unsigned = requestItems.filter((item) => item.status !== "signed").length;
            if (unsigned > 0 && daysOpen > STALE_AFTER_DAYS) staleUnsignedCount += 1;
        }
    }

    const total = requests.length;
    const completionAvg = mean(trendCounts(trendGroups));
    const avgConfirm = mean(confirmDays);

    const trend: ClearanceDashboardTrendPoint[] = [...trendGroups.entries()]
        .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))
        .slice(-TREND_PERIOD_LIMIT)
        .map(([period, count]) => ({ period, count }));

    const templateStats = new Map<number, { total: number; completed: number }>();
    for (const request of requests) {
        const entry = templateStats.get(request.template_id);
        if (entry === undefined) {
            templateStats.set(request.template_id, {
                total: 1,
                completed: request.status === "completed" ? 1 : 0,
            });
        } else {
            entry.total += 1;
            if (request.status === "completed") entry.completed += 1;
        }
    }
    const byTemplate: ClearanceDashboardTemplateRow[] = [...templateStats.entries()].map(
        ([templateId, stats]) => ({
            template_id: templateId,
            template_title:
                titlesByTemplate.get(templateId) ??
                templateTitleFor(templateId, snapshotsByTemplate.get(templateId) ?? []),
            total: stats.total,
            completed: stats.completed,
        })
    );
    byTemplate.sort((left, right) => {
        if (right.completed !== left.completed) return right.completed - left.completed;
        if (right.total !== left.total) return right.total - left.total;
        return left.template_title.localeCompare(right.template_title);
    });

    const statusMix: ClearanceDashboardStatusSlice[] = [
        { status: "pending", count: notStartedCount },
        { status: "in_progress", count: inProgressCount },
        { status: "completed", count: completedCount },
    ];

    const aging: ClearanceDashboardAgingBin[] = AGING_BIN_LABELS.map((bin) => ({ bin, count: 0 }));
    for (const open of openAges) {
        let index = Math.floor(open.daysOpen / 7);
        if (index > 4) index = 4;
        const entry = aging[index];
        if (entry !== undefined) entry.count += 1;
    }

    const oldestOpen: ClearanceDashboardOldestOpen[] = [...openAges]
        .sort((left, right) => {
            const leftCreated = left.request.created_at ?? "";
            const rightCreated = right.request.created_at ?? "";
            if (leftCreated !== rightCreated) return leftCreated < rightCreated ? -1 : 1;
            return left.request.id - right.request.id;
        })
        .slice(0, OLDEST_OPEN_LIMIT)
        .map((open) => {
            const requestItems = itemsByRequest.get(open.request.id) ?? [];
            const signed = requestItems.filter((item) => item.status === "signed").length;
            return {
                request_id: open.request.id,
                employee_name: namesByUser.get(open.request.user_id) ?? "Unknown employee",
                template_title:
                    titlesByTemplate.get(open.request.template_id) ??
                    templateTitleFor(
                        open.request.template_id,
                        snapshotsByTemplate.get(open.request.template_id) ?? []
                    ),
                days_open: open.daysOpen,
                signed_count: signed,
                total_count: requestItems.length,
                created_at: open.request.created_at,
            };
        });

    return {
        generated_at: generatedAt,
        scope: cap.visibleDepartmentIds === null ? "hr" : "head",
        stale_after_days: STALE_AFTER_DAYS,
        kpis: {
            total,
            completed_count: completedCount,
            in_progress_count: inProgressCount,
            not_started_count: notStartedCount,
            completion_rate: total === 0 ? null : round1((completedCount / total) * 100),
            avg_days_to_confirm: avgConfirm === null ? null : round1(avgConfirm),
            stale_unsigned_count: staleUnsignedCount,
        },
        trend,
        trend_avg: completionAvg === null ? null : round1(completionAvg),
        by_template: byTemplate,
        status_mix: statusMix,
        aging,
        oldest_open: oldestOpen,
        oldest_open_total: openAges.length,
    };
}

function trendCounts(groups: ReadonlyMap<string, number>): number[] {
    return [...groups.values()];
}
