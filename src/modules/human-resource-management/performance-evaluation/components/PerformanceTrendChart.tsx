"use client";

import * as React from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";
import type { PerformanceDashboardTrendPoint } from "../types/performance-dashboard.schema";

const CARD_SHELL =
    "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.45)]";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatPeriod(period: string): string {
    const match = /^(\d{4})-(\d{2})$/.exec(period);
    if (!match) return period;
    const month = Number(match[2]);
    if (month < 1 || month > 12) return period;
    return `${SHORT_MONTHS[month - 1]} ${match[1]}`;
}

interface TrendRow {
    readonly period: string;
    readonly label: string;
    readonly avg: number | null;
    readonly count: number;
}

export function PerformanceTrendChart({
    trend,
    referenceAvg,
}: {
    readonly trend: readonly PerformanceDashboardTrendPoint[];
    readonly referenceAvg?: number | null;
}) {
    const rows = React.useMemo<TrendRow[]>(
        () =>
            trend.map((point) => ({
                period: point.period,
                label: formatPeriod(point.period),
                avg: point.avg_score,
                count: point.count,
            })),
        [trend]
    );
    const scored = rows.filter((row) => row.avg !== null);
    const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
    const title = "Monthly Average Score";
    const subtitle =
        rows.length === 0
            ? "Average score per month · no periods yet"
            : `Average score per month · ${formatPeriod(rows[0].period)} to ${formatPeriod(rows[rows.length - 1].period)} · ${totalCount} evaluations`;
    const ariaSummary =
        scored.length === 0
            ? "Monthly average score chart with no data"
            : `Monthly average score chart. ${totalCount} evaluations across ${rows.length} periods.`;
    const showReference = referenceAvg !== null && referenceAvg !== undefined;
    return (
        <Card className={`${CARD_SHELL} h-full`}>
            <CardContent className="flex h-full flex-col p-5 sm:p-6">
                <div className="min-w-0">
                    <h2 className="truncate text-base font-bold tracking-tight text-foreground">{title}</h2>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">{subtitle}</p>
                </div>
                {scored.length === 0 ? (
                    <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 py-10 text-center sm:min-h-[320px]">
                        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm font-medium text-foreground">No trend data yet</p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                            Monthly averages will appear here once evaluations are recorded.
                        </p>
                    </div>
                ) : (
                    <div className="mt-3 h-[220px] min-h-[220px] flex-1 sm:h-[300px]" role="img" aria-label={ariaSummary}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                                <CartesianGrid stroke="#94a3b8" strokeOpacity={0.12} vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    domain={[0, 5]}
                                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={36}
                                />
                                <Tooltip
                                    formatter={(value) => [
                                        typeof value === "number" ? value.toFixed(2) : value,
                                        "Avg score",
                                    ]}
                                    labelFormatter={(label) => `Period: ${label}`}
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--popover))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: 12,
                                        fontSize: 12,
                                    }}
                                    labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                                    cursor={{ fill: "#7c3aed", fillOpacity: 0.1 }}
                                />
                                {showReference && (
                                    <ReferenceLine
                                        y={referenceAvg}
                                        stroke="#94a3b8"
                                        strokeDasharray="4 4"
                                        strokeOpacity={0.7}
                                        label={{
                                            value: `Avg ${Number(referenceAvg).toFixed(2)}`,
                                            position: "insideTopRight",
                                            fontSize: 11,
                                            fill: "#94a3b8",
                                        }}
                                    />
                                )}
                                <Bar
                                    dataKey="avg"
                                    name="Avg score"
                                    fill="#8b5cf6"
                                    radius={[6, 6, 0, 0]}
                                    maxBarSize={44}
                                    isAnimationActive={false}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
