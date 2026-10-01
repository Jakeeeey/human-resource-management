"use client";

import * as React from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";
import type { PerformanceDashboardBinCount } from "../types/performance-dashboard.schema";

const CARD_SHELL =
    "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.45)]";

export function ScoreDistributionChart({
    distribution,
}: {
    readonly distribution: readonly PerformanceDashboardBinCount[];
}) {
    const bins = React.useMemo(
        () =>
            distribution.map((entry) => ({
                label: entry.bin,
                count: entry.count,
            })),
        [distribution]
    );
    const total = bins.reduce((sum, bin) => sum + bin.count, 0);
    const title = "Score Distribution";
    const subtitle = `All evaluations · n=${total}`;
    const ariaSummary =
        total === 0
            ? "Score distribution chart with no data"
            : `Score distribution chart. ${bins.map((b) => `${b.label}: ${b.count}`).join(", ")}.`;
    return (
        <Card className={`${CARD_SHELL} h-full`}>
            <CardContent className="flex h-full flex-col p-5 sm:p-6">
                <h2 className="truncate text-base font-bold tracking-tight text-foreground">{title}</h2>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">{subtitle}</p>
                {total === 0 ? (
                    <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                        <p className="text-sm font-medium text-foreground">No scores yet</p>
                        <p className="max-w-xs text-xs text-muted-foreground">
                            The score spread will appear here once evaluations are recorded.
                        </p>
                    </div>
                ) : (
                    <div className="mt-3 h-[220px] min-h-[220px] flex-1 sm:h-[260px]" role="img" aria-label={ariaSummary}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={bins} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                                <CartesianGrid stroke="#94a3b8" strokeOpacity={0.12} vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    allowDecimals={false}
                                    domain={[0, "dataMax"]}
                                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={36}
                                />
                                <Tooltip
                                    formatter={(value) => [value, "Evaluations"]}
                                    labelFormatter={(label) => `Score range: ${label}`}
                                    contentStyle={{
                                        backgroundColor: "#1e1b4b",
                                        border: "none",
                                        borderRadius: 12,
                                        fontSize: 12,
                                        color: "#ffffff",
                                    }}
                                    cursor={{ fill: "#7c3aed", fillOpacity: 0.1 }}
                                />
                                <Bar dataKey="count" name="Evaluations" fill="#8b5cf6" radius={[8, 8, 0, 0]} maxBarSize={44} isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
