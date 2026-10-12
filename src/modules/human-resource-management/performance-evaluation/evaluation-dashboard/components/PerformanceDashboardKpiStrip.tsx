"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
    Award,
    CircleCheck,
    Gauge,
    TriangleAlert,
    Users,
    type LucideIcon,
} from "lucide-react";
import type { PerformanceDashboardKpis } from "../types/performance-dashboard.schema";

const CARD_SHELL =
    "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.45)]";

const TINT_VIOLET = "bg-violet-100 text-violet-600 dark:bg-violet-500/25 dark:text-violet-300";
const TINT_SKY = "bg-sky-100 text-sky-600 dark:bg-sky-500/25 dark:text-sky-300";
const TINT_EMERALD = "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-300";
const TINT_ROSE = "bg-rose-100 text-rose-600 dark:bg-rose-500/25 dark:text-rose-300";

function formatPct(value: number | null): string {
    return value === null ? "No data" : `${value.toFixed(1)}%`;
}

function workforceShare(part: number, total: number): string {
    if (total <= 0) return "No workforce data";
    return `${((part / total) * 100).toFixed(1)}% of workforce`;
}

interface KpiFigure {
    readonly key: string;
    readonly label: string;
    readonly value: string;
    readonly sub: string;
    readonly deltaIcon: LucideIcon;
    readonly deltaText: string;
    readonly caption: string;
    readonly icon: LucideIcon;
    readonly tint: string;
}

export function PerformanceDashboardKpiStrip({ kpis }: { readonly kpis: PerformanceDashboardKpis }) {
    const evaluated = kpis.evaluated_count;
    const total = kpis.total;
    const attention = kpis.attention_count;
    const attentionClear = attention <= 0;
    const figures: readonly KpiFigure[] = [
        {
            key: "avg",
            label: "Average performance score",
            value: kpis.avg_score === null ? "No data" : kpis.avg_score.toFixed(2),
            sub: kpis.avg_score_band ?? "Not yet evaluated",
            deltaIcon: Users,
            deltaText: `${evaluated} of ${total} evaluated`,
            caption: evaluated > 0 ? `Across ${evaluated} evaluated employees` : "No evaluations recorded yet",
            icon: Gauge,
            tint: TINT_VIOLET,
        },
        {
            key: "probation",
            label: "Employees on probation",
            value: String(kpis.probation_count),
            sub: workforceShare(kpis.probation_count, total),
            deltaIcon: Users,
            deltaText: total > 0 ? `${total} employees in scope` : "No employees in scope",
            caption: "Currently in probation tracking",
            icon: Users,
            tint: TINT_SKY,
        },
        {
            key: "high",
            label: "High performers",
            value: formatPct(kpis.high_performer_pct),
            sub: "Outstanding + Very Good",
            deltaIcon: Award,
            deltaText: evaluated > 0 ? `Of ${evaluated} evaluated` : "No evaluations recorded yet",
            caption: "Share in the top two bands",
            icon: Award,
            tint: TINT_EMERALD,
        },
        {
            key: "attention",
            label: "Needs attention",
            value: String(attention),
            sub: attentionClear ? "All clear" : "Action needed",
            deltaIcon: attentionClear ? CircleCheck : TriangleAlert,
            deltaText: attentionClear ? "No open risks" : "Probation risk or open PIP",
            caption: attentionClear ? "Nobody flagged right now" : "Review the list below",
            icon: attentionClear ? CircleCheck : TriangleAlert,
            tint: attentionClear ? TINT_EMERALD : TINT_ROSE,
        },
    ];
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" role="list" aria-label="Performance key figures">
            {figures.map((figure) => {
                const Icon = figure.icon;
                const DeltaIcon = figure.deltaIcon;
                return (
                    <Card key={figure.key} className={CARD_SHELL} role="listitem">
                        <CardContent className="flex items-start gap-4 p-5 sm:p-6">
                            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${figure.tint}`}>
                                <Icon className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                                    {figure.label}
                                </span>
                                <span className="mt-1 block truncate text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">
                                    {figure.value}
                                </span>
                                <span className="mt-0.5 block truncate text-xs font-medium text-muted-foreground sm:text-sm">
                                    {figure.sub}
                                </span>
                                <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground">
                                    <DeltaIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    <span className="truncate">{figure.deltaText}</span>
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                    {figure.caption}
                                </span>
                            </span>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

export function PerformanceDashboardKpiSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading key figures">
            {[0, 1, 2, 3].map((index) => (
                <div key={index} className={`${CARD_SHELL} flex items-start gap-4 p-5 sm:p-6`}>
                    <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-muted" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                        <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                    </div>
                </div>
            ))}
        </div>
    );
}
